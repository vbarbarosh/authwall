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
            status: response.status,
            method: request.method,
            path: request.path,
            request: `${request.method} ${request.path}`,
        });
        delete requests[uid];
        delete responses[uid];
    }
}

function summarize_log_requests(requests)
{
    const rows_by_key = {};

    for (const request of requests) {
        const key = [request.ip, request.status, request.request].join('\0');
        rows_by_key[key] ??= {
            ip: request.ip,
            status: request.status,
            request: request.request,
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

    out.push(
        `Requests: ${summary.total}`,
        ...format_table(['IP', 'Status', 'METHOD path', 'Counter'], summary.rows.map(v => [
            v.ip,
            v.status,
            v.request,
            String(v.counter),
        ]))
    );

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

    return {
        method: method_match[1],
        path: format_request_path(url_value.value, options),
        ip: parse_fingerprint_ip(fingerprint_value.value),
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
        || a.status.localeCompare(b.status)
        || a.request.localeCompare(b.request);
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
        '  --json             Print the summary as JSON',
        '  -h, --help         Show this help',
        '',
        'Examples:',
        '  bin/log-summary today',
        '  bin/log-summary yesterday',
        '  bin/log-summary 2026-04-26 --logs-dir data/authwall/logs',
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
