const assert = require('assert');
const {
    parse_activity_summary_args,
    render_activity_summary,
    summarize_activity_events,
    usage,
} = require('./render_activity_summary');

describe('render_activity_summary', function () {

    it('parses common period arguments', function () {
        const now = new Date('2026-05-09T12:00:00.000Z');

        assert.deepStrictEqual(period(parse_activity_summary_args([], now)), {
            label: 'last day',
            since: '2026-05-08T12:00:00.000Z',
            until: '2026-05-09T12:00:00.000Z',
        });
        assert.deepStrictEqual(period(parse_activity_summary_args(['several-days'], now)), {
            label: 'last several days',
            since: '2026-05-06T12:00:00.000Z',
            until: '2026-05-09T12:00:00.000Z',
        });
        assert.deepStrictEqual(period(parse_activity_summary_args(['week'], now)), {
            label: 'last week',
            since: '2026-05-02T12:00:00.000Z',
            until: '2026-05-09T12:00:00.000Z',
        });
        assert.deepStrictEqual(period(parse_activity_summary_args(['--days=2'], now)), {
            label: 'last 2 days',
            since: '2026-05-07T12:00:00.000Z',
            until: '2026-05-09T12:00:00.000Z',
        });
    });

    it('summarizes auth events into activity metrics', function () {
        const options = parse_activity_summary_args(['week'], new Date('2026-05-09T12:00:00.000Z'));
        const summary = summarize_activity_events([
            event({event_type: 'sign_up', user_id: 1, session_uid: 's1', identity_type: 'email', identity_value: 'Alice@Example.com', identity_value_normalized: 'alice@example.com', ip: '10.0.0.1', created_at: '2026-05-03T10:15:00.000Z'}),
            event({event_type: 'sign_in', user_id: 1, session_uid: 's1', identity_type: 'username', identity_value: 'alice', ip: '10.0.0.1', created_at: '2026-05-03T11:15:00.000Z'}),
            event({event_type: 'sign_in', event_status: 'failure', identity_type: 'email', identity_value: 'bob@example.com', ip: '10.0.0.2', created_at: '2026-05-03T11:20:00.000Z'}),
            event({event_type: 'password_reset_requested', event_status: 'noop', user_id: 1, ip: '10.0.0.1', created_at: '2026-05-04T12:00:00.000Z'}),
            event({event_type: 'identity_added', user_id: 1, session_uid: 's1', identity_type: 'google', ip: '10.0.0.1', created_at: '2026-05-05T12:00:00.000Z'}),
        ], options);

        assert.strictEqual(summary.total, 5);
        assert.strictEqual(summary.statuses.success, 3);
        assert.strictEqual(summary.statuses.failure, 1);
        assert.strictEqual(summary.statuses.noop, 1);
        assert.deepStrictEqual(summary.actors, {users: 1, sessions: 1, ips: 2});
        assert.strictEqual(summary.highlights.sign_ups, 1);
        assert.strictEqual(summary.highlights.sign_ins, 2);
        assert.strictEqual(summary.highlights.failed_sign_ins, 1);
        assert.strictEqual(summary.highlights.password_reset_requests, 1);
        assert.deepStrictEqual(summary.attempts, [
            {
                at: '2026-05-03T10:15:00.000Z',
                event_type: 'sign_up',
                event_status: 'success',
                identity_type: 'email',
                identity_value: 'Alice@Example.com',
                identity_value_normalized: 'alice@example.com',
                user_id: 1,
                ip: '10.0.0.1',
            },
            {
                at: '2026-05-03T11:15:00.000Z',
                event_type: 'sign_in',
                event_status: 'success',
                identity_type: 'username',
                identity_value: 'alice',
                identity_value_normalized: null,
                user_id: 1,
                ip: '10.0.0.1',
            },
            {
                at: '2026-05-03T11:20:00.000Z',
                event_type: 'sign_in',
                event_status: 'failure',
                identity_type: 'email',
                identity_value: 'bob@example.com',
                identity_value_normalized: null,
                user_id: null,
                ip: '10.0.0.2',
            },
        ]);
        assert.deepStrictEqual(summary.top_failure_ips, [{name: '10.0.0.2', value: 1}]);
        assert.deepStrictEqual(summary.timeline, [
            {bucket: '2026-05-03', total: 3, success: 2, failure: 1, noop: 0},
            {bucket: '2026-05-04', total: 1, success: 0, failure: 0, noop: 1},
            {bucket: '2026-05-05', total: 1, success: 1, failure: 0, noop: 0},
        ]);

        const text = render_activity_summary(summary).join('\n');
        assert.match(text, /Events: 5 total, 3 success, 1 failure, 1 noop/);
        assert.match(text, /Core flow: 1 sign-ups, 2 sign-ins \(1 failed\), 0 sign-outs/);
        assert.match(text, /Sign-in\/sign-up attempts:\n\s+Time\s+Event\s+Status\s+Identity\s+User\s+IP\n\s+--\s+-+\s+-+\s+-+\s+-+\s+-+\s+-+\n\s+🆕\s+2026-05-03T10:15:00.000Z\s+sign_up\s+success\s+email=Alice@Example.com\s+1\s+10\.0\.0\.1\n\s+2026-05-03T11:15:00.000Z\s+sign_in\s+success\s+username=alice\s+1\s+10\.0\.0\.1\n\s+🚨\s+2026-05-03T11:20:00.000Z\s+sign_in\s+failure\s+email=bob@example\.com\s+-\s+10\.0\.0\.2/);
        assert.doesNotMatch(text, /🔐/);
        assert.doesNotMatch(text, /session=/);
        assert.match(text, /Identity types:\n  email: 2\n  google: 1\n  username: 1/);
        assert.match(text, /Failure sources:\n  10\.0\.0\.2: 1/);
    });

    it('renders an empty period clearly', function () {
        const options = parse_activity_summary_args(['day'], new Date('2026-05-09T12:00:00.000Z'));
        const lines = render_activity_summary(summarize_activity_events([], options));

        assert.match(lines.join('\n'), /No auth events found in this period/);
    });

    it('provides cli usage', function () {
        assert.match(usage().join('\n'), /bin\/activity-summary week/);
    });

});

function event(overrides)
{
    return {
        id: 1,
        user_id: null,
        session_uid: null,
        event_type: 'sign_in',
        event_status: 'success',
        identity_type: null,
        identity_value: null,
        identity_value_normalized: null,
        ip: null,
        created_at: '2026-05-03T10:00:00.000Z',
        ...overrides,
    };
}

function period(options)
{
    return {
        label: options.label,
        since: options.since.toISOString(),
        until: options.until.toISOString(),
    };
}
