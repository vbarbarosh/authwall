const const_auth_event = require('../const/const_auth_event');
const const_user_identity = require('../const/const_user_identity');
const db = require('../../../db');

const day_ms = 24 * 60 * 60 * 1000;
const hour_ms = 60 * 60 * 1000;

function parse_activity_summary_args(argv, now = new Date())
{
    const args = [...argv];
    const options = {
        days: 1,
        label: 'last day',
        json: false,
        help: false,
        until: now,
        since: null,
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

        if (arg === '--days') {
            options.days = parse_days(args[++i], '--days');
            options.label = `last ${format_days_label(options.days)}`;
            continue;
        }

        if (arg.startsWith('--days=')) {
            options.days = parse_days(arg.slice('--days='.length), '--days');
            options.label = `last ${format_days_label(options.days)}`;
            continue;
        }

        if (arg === '--since') {
            options.since = parse_date_arg(args[++i], '--since');
            options.label = 'custom period';
            continue;
        }

        if (arg.startsWith('--since=')) {
            options.since = parse_date_arg(arg.slice('--since='.length), '--since');
            options.label = 'custom period';
            continue;
        }

        if (arg === '--until') {
            options.until = parse_date_arg(args[++i], '--until');
            options.label = 'custom period';
            continue;
        }

        if (arg.startsWith('--until=')) {
            options.until = parse_date_arg(arg.slice('--until='.length), '--until');
            options.label = 'custom period';
            continue;
        }

        if (arg === 'day') {
            options.days = 1;
            options.label = 'last day';
            continue;
        }

        if (arg === 'several' && args[i + 1] === 'days') {
            ++i;
            options.days = 3;
            options.label = 'last several days';
            continue;
        }

        if (arg === 'several' || arg === 'several-days' || arg === 'several_days') {
            options.days = 3;
            options.label = 'last several days';
            continue;
        }

        if (arg === 'week') {
            options.days = 7;
            options.label = 'last week';
            continue;
        }

        if (/^\d+d$/.test(arg)) {
            options.days = parse_days(arg.slice(0, -1), arg);
            options.label = `last ${format_days_label(options.days)}`;
            continue;
        }

        if (/^\d+$/.test(arg)) {
            options.days = parse_days(arg, arg);
            options.label = `last ${format_days_label(options.days)}`;
            continue;
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    if (!options.since) {
        options.since = new Date(options.until.getTime() - options.days * day_ms);
    }

    if (options.since >= options.until) {
        throw new Error('--since must be earlier than --until');
    }

    return options;
}

async function load_activity_summary_events(options)
{
    const events = await db('auth_events')
        .where('created_at', '>=', options.since)
        .where('created_at', '<', options.until)
        .orderBy('created_at', 'asc');
    await attach_user_emails(events);
    return events;
}

async function attach_user_emails(events)
{
    const user_ids = Array.from(new Set(events.map(v => v.user_id).filter(Boolean)));
    if (!user_ids.length) {
        return;
    }

    const identities = await db('user_identities')
        .where({type: const_user_identity.email})
        .whereIn('user_id', user_ids)
        .orderBy('id', 'asc');
    const emails = {};
    for (const ident of identities) {
        emails[ident.user_id] ??= ident.value;
    }
    for (const event of events) {
        event.user_email = emails[event.user_id] ?? null;
    }
}

function summarize_activity_events(events, options)
{
    const out = {
        label: options.label,
        since: options.since.toISOString(),
        until: options.until.toISOString(),
        bucket: options.until - options.since <= 2 * day_ms ? 'hour' : 'day',
        total: events.length,
        statuses: {},
        event_types: {},
        event_statuses: {},
        identity_types: {},
        events: [],
        actors: {
            users: 0,
            sessions: 0,
            ips: 0,
        },
        highlights: {},
        top_failure_ips: [],
        timeline: [],
    };

    const users = new Set();
    const sessions = new Set();
    const ips = new Set();
    const top_failure_ips = {};
    const timeline = {};

    for (const event of events) {
        increment(out.statuses, event.event_status || 'unknown');
        increment(out.event_types, event.event_type || 'unknown');
        increment_event_status(out.event_statuses, event.event_type || 'unknown', event.event_status || 'unknown');
        out.events.push(format_event(event));

        if (event.identity_type) {
            increment(out.identity_types, event.identity_type);
        }
        if (event.user_id) {
            users.add(event.user_id);
        }
        if (event.session_uid) {
            sessions.add(event.session_uid);
        }
        if (event.ip) {
            ips.add(event.ip);
        }
        if (event.event_status === 'failure' && event.ip) {
            increment(top_failure_ips, event.ip);
        }
        const bucket = format_bucket(parse_event_date(event.created_at), out.bucket);
        timeline[bucket] ??= {bucket, total: 0, success: 0, failure: 0, noop: 0};
        ++timeline[bucket].total;
        if (event.event_status && Object.hasOwn(timeline[bucket], event.event_status)) {
            ++timeline[bucket][event.event_status];
        }
    }

    out.actors.users = users.size;
    out.actors.sessions = sessions.size;
    out.actors.ips = ips.size;
    out.highlights = make_highlights(out);
    add_failed_sign_ins(out, events);
    out.top_failure_ips = top_entries(top_failure_ips, 5);
    out.timeline = Object.values(timeline);

    return out;
}

function render_activity_summary(summary)
{
    const out = [
        'Authwall activity summary',
    ];

    if (!summary.total) {
        out.push('No auth events found in this period.');
        return out;
    }

    out.push(
        'Auth events:',
        ...format_events(summary.events).map(v => `  ${v}`),
        'Summary:',
        `  Period: ${summary.label} (${summary.since} to ${summary.until})`,
        `  Events: ${summary.total} total, ${count(summary.statuses.success)} success, ${count(summary.statuses.failure)} failure, ${count(summary.statuses.noop)} noop`,
        `  Actors: ${summary.actors.users} users, ${summary.actors.sessions} sessions, ${summary.actors.ips} IPs`,
        'Events by type/status:',
        ...format_event_statuses(summary.event_statuses).map(v => `  ${v}`)
    );

    return out;
}

function make_highlights(summary)
{
    return {
        sign_ups: count(summary.event_types[const_auth_event.sign_up]),
        sign_ins: count(summary.event_types[const_auth_event.sign_in]),
        failed_sign_ins: 0,
        sign_outs: count(summary.event_types[const_auth_event.sign_out]),
        profile_updates: count(summary.event_types[const_auth_event.profile_updated]) + count(summary.event_types[const_auth_event.avatar_updated]),
        identity_added: count(summary.event_types[const_auth_event.identity_added]),
        identity_removed: count(summary.event_types[const_auth_event.identity_removed]),
        email_changes: count(summary.event_types[const_auth_event.email_changed]) + count(summary.event_types[const_auth_event.email_change_requested]),
        password_changes: count(summary.event_types[const_auth_event.password_changed]),
        account_removals: count(summary.event_types[const_auth_event.account_removed]),
        password_reset_requests: count(summary.event_types[const_auth_event.password_reset_requested]),
        password_reset_completed: count(summary.event_types[const_auth_event.password_reset_completed]),
        email_verification_requests: count(summary.event_types[const_auth_event.email_verification_requested]),
        email_verified: count(summary.event_types[const_auth_event.email_verified]),
    };
}

function add_failed_sign_ins(summary, events)
{
    summary.highlights.failed_sign_ins = events.filter(v => v.event_type === const_auth_event.sign_in && v.event_status === 'failure').length;
}

function format_event(event)
{
    return {
        at: parse_event_date(event.created_at).toISOString(),
        event_type: event.event_type || '',
        event_status: event.event_status || '',
        user_id: event.user_id ?? null,
        user_email: event.user_email ?? null,
        identity_type: event.identity_type ?? null,
        identity_value: event.identity_value ?? null,
        identity_value_normalized: event.identity_value_normalized ?? null,
        ip: event.ip ?? null,
    };
}

function format_events(events)
{
    if (!events.length) {
        return ['none'];
    }
    const rows = events.map(function (event) {
        return [
            format_event_marker(event),
            event.at,
            event.event_type,
            event.event_status,
            format_user(event),
            event.identity_type || '-',
            event.identity_value || event.identity_value_normalized || '-',
            event.ip || '-',
        ];
    });
    return format_table(['', 'Time', 'Event', 'Status', 'User', 'Identity Type', 'Identity', 'IP'], rows);
}

function format_user(event)
{
    if (!event.user_id) {
        return '-';
    }
    return `${event.user_id}:${event.user_email || '-'}`;
}

function format_event_marker(event)
{
    if (event.event_status === 'failure') {
        return '🚨';
    }
    if (event.event_status === 'noop') {
        return '➖';
    }
    return '';
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

function parse_days(value, name)
{
    const out = Number(value);
    if (!Number.isInteger(out) || out < 1 || out > 366) {
        throw new Error(`${name} must be an integer from 1 to 366`);
    }
    return out;
}

function parse_date_arg(value, name)
{
    if (!value) {
        throw new Error(`${name} requires a date`);
    }
    const out = new Date(value);
    if (Number.isNaN(out.getTime())) {
        throw new Error(`${name} contains an invalid date: ${value}`);
    }
    return out;
}

function parse_event_date(value)
{
    if (value instanceof Date) {
        return value;
    }
    return new Date(value);
}

function format_days_label(days)
{
    return days === 1 ? 'day' : `${days} days`;
}

function format_bucket(date, bucket)
{
    const time = bucket === 'hour'
        ? Math.floor(date.getTime() / hour_ms) * hour_ms
        : Math.floor(date.getTime() / day_ms) * day_ms;
    const iso = new Date(time).toISOString();
    return bucket === 'hour' ? iso.slice(0, 13) + ':00Z' : iso.slice(0, 10);
}

function increment(obj, key)
{
    obj[key] = count(obj[key]) + 1;
}

function increment_event_status(obj, event_type, event_status)
{
    obj[event_type] ??= {};
    increment(obj[event_type], event_status);
}

function count(value)
{
    return value || 0;
}

function top_entries(obj, limit)
{
    return Object.entries(obj)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([name, value]) => ({name, value}));
}

function format_top(obj, limit = Infinity)
{
    const entries = top_entries(obj, limit);
    return entries.length ? format_top_entries(entries) : ['none'];
}

function format_top_entries(entries)
{
    return entries.length ? entries.map(v => `${v.name}: ${v.value}`) : ['none'];
}

function format_event_statuses(values)
{
    const entries = Object.entries(values)
        .sort((a, b) => total_statuses(b[1]) - total_statuses(a[1]) || a[0].localeCompare(b[0]));
    if (!entries.length) {
        return ['none'];
    }
    return entries.map(function ([event_type, statuses]) {
        const parts = ['success', 'failure', 'noop', 'unknown']
            .filter(v => statuses[v])
            .map(v => `${v}=${statuses[v]}`);
        return `${event_type}: ${parts.join(' ')}`;
    });
}

function total_statuses(statuses)
{
    return Object.values(statuses).reduce((a, b) => a + b, 0);
}

function usage()
{
    return [
        'Usage: bin/activity-summary [day|several-days|week|<days>d] [options]',
        '',
        'Options:',
        '  --days N       Summarize the last N days',
        '  --since DATE   Start date/time, inclusive',
        '  --until DATE   End date/time, exclusive; defaults to now',
        '  --json         Print the summary as JSON',
        '  -h, --help     Show this help',
        '',
        'Examples:',
        '  bin/activity-summary day',
        '  bin/activity-summary several-days',
        '  bin/activity-summary week',
        '  bin/activity-summary --since 2026-05-01 --until 2026-05-08',
    ];
}

module.exports = {
    load_activity_summary_events,
    parse_activity_summary_args,
    render_activity_summary,
    summarize_activity_events,
    usage,
};
