const config = require('../../../config');
const fs = require('fs');
const path = require('path');

function parse_log_summary_args(argv, now = new Date())
{
    const args = [...argv];
    const options = {
        date: format_date(now),
        file: null,
        logs_dir: config.logs_dir,
        json: false,
        help: false,
        include_query: false,
        groups: [],
    };

    for (let i = 0; i < args.length; ++i) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }

        if (arg === '--json') {
            options.json = true;
            continue;
        }

        if (arg === '--query') {
            options.include_query = true;
            continue;
        }

        if (arg === '--group') {
            options.groups.push(require_value(args[++i], '--group'));
            continue;
        }

        if (arg.startsWith('--group=')) {
            options.groups.push(require_value(arg.slice('--group='.length), '--group'));
            continue;
        }

        if (arg === '--date') {
            options.date = parse_date(args[++i], '--date');
            continue;
        }

        if (arg.startsWith('--date=')) {
            options.date = parse_date(arg.slice('--date='.length), '--date');
            continue;
        }

        if (arg === '--file') {
            options.file = require_value(args[++i], '--file');
            continue;
        }

        if (arg.startsWith('--file=')) {
            options.file = require_value(arg.slice('--file='.length), '--file');
            continue;
        }

        if (arg === '--logs-dir') {
            options.logs_dir = require_value(args[++i], '--logs-dir');
            continue;
        }

        if (arg.startsWith('--logs-dir=')) {
            options.logs_dir = require_value(arg.slice('--logs-dir='.length), '--logs-dir');
            continue;
        }

        if (arg === 'today') {
            options.date = format_date(now);
            continue;
        }

        if (arg === 'yesterday') {
            options.date = format_date(new Date(now.getTime() - 24 * 60 * 60 * 1000));
            continue;
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
            options.date = parse_date(arg, arg);
            continue;
        }

        if (!arg.startsWith('-') && !options.file) {
            options.file = arg;
            continue;
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    if (!options.file) {
        options.file = path.join(options.logs_dir, `app-${options.date}.log`);
    }

    return options;
}

function load_log_summary_requests(options)
{
    const text = fs.readFileSync(options.file, {encoding: 'utf8'});
    return parse_log_summary_requests(text, options);
}

function parse_log_summary_requests(text, options = {})
{
    const requests = {};
    const responses = {};
    const out = [];

    for (const line of text.split(/\r?\n/)) {
        if (!line) {
            continue;
        }

        const parsed = parse_log_line(line);
        if (!parsed) {
            continue;
        }

        if (parsed.tags.includes('req_begin')) {
            requests[parsed.uid] = parse_req_begin(parsed.message, options);
            flush_complete(parsed.uid);
            continue;
        }

        if (parsed.tags.includes('res_close')) {
            responses[parsed.uid] = parse_res_close(parsed.message);
            flush_complete(parsed.uid);
        }
    }

    return out;

    function flush_complete(uid) {
        const request = requests[uid];
        const response = responses[uid];
        if (!request || !response) {
            return;
        }
        out.push({
            ip: request.ip,
            ua: request.ua,
            status: response.status,
            method: request.method,
            path: request.path,
            request: `${request.method} ${request.path}`,
        });
        delete requests[uid];
        delete responses[uid];
    }
}

function summarize_log_requests(requests, options = {})
{
    const rows_by_key = {};
    const group_matchers = (options.groups || []).map(pattern => ({
        pattern,
        regexp: glob_to_regexp(pattern),
    }));

    for (const request of requests) {
        const group_matcher = group_matchers.find(v => v.regexp.test(request.request));
        const row = group_matcher
            ? {ip: '*', ua: '*', status: '*', request: group_matcher.pattern}
            : request;
        const key = [row.ip, row.ua, row.status, row.request].join('\0');
        rows_by_key[key] ??= {
            ip: row.ip,
            ua: row.ua,
            status: row.status,
            request: row.request,
            counter: 0,
        };
        rows_by_key[key].counter++;
    }

    return {
        total: requests.length,
        rows: Object.values(rows_by_key).sort(compare_rows),
    };
}

function render_log_summary(summary, options)
{
    const out = [
        'Authwall log summary',
        `Log file: ${options.file}`,
    ];

    if (!summary.total) {
        out.push('No completed requests found.');
        return out;
    }

    out.push(`Requests: ${summary.total}`);

    const has_ua = summary.rows.some(v => v.ua && v.ua !== '-' && v.ua !== '*');
    const headers = has_ua ? ['IP', 'Status', 'METHOD path', 'Counter', 'UA'] : ['IP', 'Status', 'METHOD path', 'Counter'];
    const rows = summary.rows.map(v => has_ua
        ? [v.ip, v.status, v.request, String(v.counter), v.ua || '-']
        : [v.ip, v.status, v.request, String(v.counter)]);
    out.push(...format_table(headers, rows));

    return out;
}

function parse_log_line(line)
{
    const tags = [];
    let i = 0;

    while (line[i] === '[') {
        const j = line.indexOf(']', i);
        if (j === -1) {
            break;
        }
        tags.push(line.slice(i + 1, j));
        i = j + 1;
    }

    if (tags.length < 2) {
        return null;
    }

    return {
        at: tags[0],
        uid: tags[1],
        tags,
        message: line.slice(i).trimStart(),
    };
}

function parse_req_begin(message, options)
{
    const method_match = message.match(/^([A-Z]+)\s+/);
    if (!method_match) {
        throw new Error(`Invalid req_begin line: ${message}`);
    }

    let i = method_match[0].length;
    const url_value = consume_json_string(message, i, 'request URL');
    i = url_value.next;
    const fingerprint_value = consume_json_string(message, i, 'request fingerprint');
    i = fingerprint_value.next;
    const headers = parse_headers(message.slice(i).trimStart());

    return {
        method: method_match[1],
        path: format_request_path(url_value.value, options),
        ip: parse_request_ip(fingerprint_value.value, headers),
        ua: format_user_agent(parse_fingerprint_ua(fingerprint_value.value) || headers['user-agent']),
    };
}

function parse_res_close(message)
{
    const match = message.match(/^(\d{3})\b/);
    if (!match) {
        throw new Error(`Invalid res_close line: ${message}`);
    }
    return {status: match[1]};
}

function consume_json_string(s, start, label)
{
    let i = start;
    while (s[i] === ' ') {
        i++;
    }
    if (s[i] !== '"') {
        throw new Error(`Invalid ${label}: ${s}`);
    }

    let escaped = false;
    for (let j = i + 1; j < s.length; ++j) {
        if (escaped) {
            escaped = false;
            continue;
        }
        if (s[j] === '\\') {
            escaped = true;
            continue;
        }
        if (s[j] === '"') {
            return {
                value: JSON.parse(s.slice(i, j + 1)),
                next: j + 1,
            };
        }
    }

    throw new Error(`Unterminated ${label}: ${s}`);
}

function parse_fingerprint_ip(fingerprint)
{
    const match = fingerprint.match(/\[ip=([^\]]*)]/);
    return match && match[1] ? match[1] : 'n/a';
}

function parse_fingerprint_forwarded(fingerprint)
{
    const match = fingerprint.match(/\[forwarded=([^\]]*)]/);
    return match && match[1] ? match[1] : 'n/a';
}

function parse_request_ip(fingerprint, headers)
{
    return first_forwarded_ip(headers['x-forwarded-for'])
        || first_forwarded_ip(headers['x-real-ip'])
        || first_forwarded_ip(parse_fingerprint_forwarded(fingerprint))
        || parse_fingerprint_ip(fingerprint);
}

function first_forwarded_ip(value)
{
    if (!value || value === 'n/a') {
        return null;
    }
    const first = String(value).split(',')[0].trim();
    return first && first !== 'n/a' ? first : null;
}

function parse_fingerprint_ua(fingerprint)
{
    const match = fingerprint.match(/\[ua=([^\]]*)]/);
    if (!match || !match[1] || match[1] === 'n/a') {
        return null;
    }
    return match[1];
}

function parse_headers(s)
{
    if (!s) {
        return {};
    }
    try {
        return JSON.parse(s);
    }
    catch {
        return {};
    }
}

function format_user_agent(ua)
{
    if (!ua || ua === 'n/a') {
        return '-';
    }

    const browser = format_user_agent_browser(ua);
    const os = format_user_agent_os(ua);
    return [browser, os].filter(Boolean).join(' / ') || ua;
}

function format_user_agent_browser(ua)
{
    let match = ua.match(/\bEdg\/([0-9.]+)/);
    if (match) {
        return `Edge ${format_major_version(match[1])}`;
    }

    match = ua.match(/\bOPR\/([0-9.]+)/);
    if (match) {
        return `Opera ${format_major_version(match[1])}`;
    }

    match = ua.match(/\bChrome\/([0-9.]+)/);
    if (match) {
        return `Chrome ${format_major_version(match[1])}`;
    }

    match = ua.match(/\bFirefox\/([0-9.]+)/);
    if (match) {
        return `Firefox ${format_major_version(match[1])}`;
    }

    match = ua.match(/\bVersion\/([0-9.]+).*?\bSafari\//);
    if (match) {
        return `Safari ${format_major_minor_version(match[1])}`;
    }

    match = ua.match(/\bSafari\/([0-9.]+)/);
    if (match) {
        return `Safari ${format_major_version(match[1])}`;
    }

    return null;
}

function format_user_agent_os(ua)
{
    let match = ua.match(/\bWindows NT ([0-9.]+)/);
    if (match) {
        return 'Windows';
    }

    match = ua.match(/\bMac OS X ([0-9_]+)/);
    if (match) {
        return `macOS ${match[1].replace(/_/g, '.')}`;
    }

    match = ua.match(/\bAndroid ([0-9.]+)/);
    if (match) {
        return `Android ${format_major_version(match[1])}`;
    }

    match = ua.match(/\bOS ([0-9_]+).* like Mac OS X/);
    if (match) {
        return `iOS ${match[1].replace(/_/g, '.')}`;
    }

    if (ua.includes('Linux')) {
        return 'Linux';
    }

    return null;
}

function format_major_version(version)
{
    return version.split('.')[0];
}

function format_major_minor_version(version)
{
    return version.split('.').slice(0, 2).join('.');
}

function format_request_path(url, options)
{
    if (options.include_query) {
        return url || '/';
    }
    try {
        return new URL(url, 'http://authwall.local').pathname || '/';
    }
    catch {
        return String(url || '/').split('?')[0] || '/';
    }
}

function format_table(headers, rows)
{
    const widths = headers.map((header, i) => Math.max(header.length, ...rows.map(row => row[i].length)));
    const format_row = row => row.map((cell, i) => cell.padEnd(widths[i])).join('  ').trimEnd();
    return [
        format_row(headers),
        format_row(widths.map(width => '-'.repeat(width))),
        ...rows.map(format_row),
    ];
}

function compare_rows(a, b)
{
    return b.counter - a.counter
        || a.ip.localeCompare(b.ip)
        || a.ua.localeCompare(b.ua)
        || a.status.localeCompare(b.status)
        || a.request.localeCompare(b.request);
}

function glob_to_regexp(glob)
{
    return new RegExp(`^${glob.split('').map(function (char) {
        if (char === '*') {
            return '.*';
        }
        if (char === '?') {
            return '.';
        }
        return char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }).join('')}$`);
}

function parse_date(value, name)
{
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
        throw new Error(`${name} must be YYYY-MM-DD`);
    }
    return value;
}

function format_date(date)
{
    return date.toISOString().slice(0, 10);
}

function require_value(value, name)
{
    if (!value) {
        throw new Error(`${name} requires a value`);
    }
    return value;
}

function usage()
{
    return [
        'Usage: bin/log-summary [today|yesterday|YYYY-MM-DD|PATH] [options]',
        '',
        'Options:',
        '  --date YYYY-MM-DD  Read app-YYYY-MM-DD.log from the logs directory',
        '  --file PATH        Read an explicit log file',
        '  --logs-dir DIR     Directory containing daily app-YYYY-MM-DD.log files',
        '  --query            Group by full URL path including query string',
        '  --group GLOB       Collapse matching METHOD path values into one count row',
        '  --json             Print the summary as JSON',
        '  -h, --help         Show this help',
        '',
        'Examples:',
        '  bin/log-summary today',
        '  bin/log-summary yesterday',
        '  bin/log-summary 2026-04-26 --logs-dir data/authwall/logs',
        '  bin/log-summary today --group "GET /t/1024/*"',
        '  bin/log-summary --file data/authwall/logs/app-2026-04-26.log',
    ];
}

module.exports = {
    load_log_summary_requests,
    parse_log_summary_args,
    parse_log_summary_requests,
    render_log_summary,
    summarize_log_requests,
    usage,
};
