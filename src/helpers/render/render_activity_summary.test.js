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
            event({event_type: 'sign_up', user_id: 1, user_email: 'alice@example.com', session_uid: 's1', identity_type: 'email', identity_value: 'Alice@Example.com', identity_value_normalized: 'alice@example.com', ip: '10.0.0.1', created_at: '2026-05-03T10:15:00.000Z'}),
            event({event_type: 'sign_in', user_id: 1, user_email: 'alice@example.com', session_uid: 's1', identity_type: 'oauth_google', identity_value: '1141xxx', identity_value_normalized: '1141xxx', ip: '10.0.0.1', created_at: '2026-05-03T11:15:00.000Z'}),
            event({event_type: 'sign_in', event_status: 'failure', identity_type: 'email', identity_value: 'bob@example.com', ip: '10.0.0.2', created_at: '2026-05-03T11:20:00.000Z'}),
            event({event_type: 'change_me_email_not_authorized', event_status: 'failure', ip: '10.0.0.3', created_at: '2026-05-03T11:25:00.000Z'}),
            event({event_type: 'password_reset_requested', event_status: 'noop', user_id: 1, ip: '10.0.0.1', created_at: '2026-05-04T12:00:00.000Z'}),
            event({event_type: 'identity_added', user_id: 1, session_uid: 's1', identity_type: 'google', ip: '10.0.0.1', created_at: '2026-05-05T12:00:00.000Z'}),
        ], options);

        assert.strictEqual(summary.total, 6);
        assert.strictEqual(summary.statuses.success, 3);
        assert.strictEqual(summary.statuses.failure, 2);
        assert.strictEqual(summary.statuses.noop, 1);
        assert.deepStrictEqual(summary.event_statuses, {
            change_me_email_not_authorized: {failure: 1},
            identity_added: {success: 1},
            password_reset_requested: {noop: 1},
            sign_in: {success: 1, failure: 1},
            sign_up: {success: 1},
        });
        assert.deepStrictEqual(summary.actors, {users: 1, sessions: 1, ips: 3});
        assert.strictEqual(summary.highlights.sign_ups, 1);
        assert.strictEqual(summary.highlights.sign_ins, 2);
        assert.strictEqual(summary.highlights.failed_sign_ins, 1);
        assert.strictEqual(summary.highlights.password_reset_requests, 1);
        assert.deepStrictEqual(summary.events, [
            {
                at: '2026-05-03T10:15:00.000Z',
                event_type: 'sign_up',
                event_status: 'success',
                user_id: 1,
                user_email: 'alice@example.com',
                identity_type: 'email',
                identity_value: 'Alice@Example.com',
                identity_value_normalized: 'alice@example.com',
                ip: '10.0.0.1',
            },
            {
                at: '2026-05-03T11:15:00.000Z',
                event_type: 'sign_in',
                event_status: 'success',
                user_id: 1,
                user_email: 'alice@example.com',
                identity_type: 'oauth_google',
                identity_value: '1141xxx',
                identity_value_normalized: '1141xxx',
                ip: '10.0.0.1',
            },
            {
                at: '2026-05-03T11:20:00.000Z',
                event_type: 'sign_in',
                event_status: 'failure',
                user_id: null,
                user_email: null,
                identity_type: 'email',
                identity_value: 'bob@example.com',
                identity_value_normalized: null,
                ip: '10.0.0.2',
            },
            {
                at: '2026-05-03T11:25:00.000Z',
                event_type: 'change_me_email_not_authorized',
                event_status: 'failure',
                user_id: null,
                user_email: null,
                identity_type: null,
                identity_value: null,
                identity_value_normalized: null,
                ip: '10.0.0.3',
            },
            {
                at: '2026-05-04T12:00:00.000Z',
                event_type: 'password_reset_requested',
                event_status: 'noop',
                user_id: 1,
                user_email: null,
                identity_type: null,
                identity_value: null,
                identity_value_normalized: null,
                ip: '10.0.0.1',
            },
            {
                at: '2026-05-05T12:00:00.000Z',
                event_type: 'identity_added',
                event_status: 'success',
                user_id: 1,
                user_email: null,
                identity_type: 'google',
                identity_value: null,
                identity_value_normalized: null,
                ip: '10.0.0.1',
            },
        ]);
        assert.deepStrictEqual(summary.top_failure_ips, [{name: '10.0.0.2', value: 1}, {name: '10.0.0.3', value: 1}]);
        assert.deepStrictEqual(summary.timeline, [
            {bucket: '2026-05-03', total: 4, success: 2, failure: 2, noop: 0},
            {bucket: '2026-05-04', total: 1, success: 0, failure: 0, noop: 1},
            {bucket: '2026-05-05', total: 1, success: 1, failure: 0, noop: 0},
        ]);

        const text = render_activity_summary(summary).join('\n');
        assert.match(text, /Auth events:\n\s+Time\s+Event\s+Status\s+User\s+Identity Type\s+Identity\s+IP\n\s+--\s+-+\s+-+\s+-+\s+-+\s+-+\s+-+\s+-+\n\s+2026-05-03T10:15:00.000Z\s+sign_up\s+success\s+1:alice@example.com\s+email\s+Alice@Example.com\s+10\.0\.0\.1\n\s+2026-05-03T11:15:00.000Z\s+sign_in\s+success\s+1:alice@example.com\s+oauth_google\s+1141xxx\s+10\.0\.0\.1\n\s+🚨\s+2026-05-03T11:20:00.000Z\s+sign_in\s+failure\s+-\s+email\s+bob@example.com\s+10\.0\.0\.2\n\s+🚨\s+2026-05-03T11:25:00.000Z\s+change_me_email_not_authorized\s+failure\s+-\s+-\s+-\s+10\.0\.0\.3/);
        assert.match(text, /Auth events:[\s\S]*Summary:\n  Period: last week \(2026-05-02T12:00:00.000Z to 2026-05-09T12:00:00.000Z\)\n  Events: 6 total, 3 success, 2 failure, 1 noop\n  Actors: 1 users, 1 sessions, 3 IPs\nEvents by type\/status:\n  sign_in: success=1 failure=1\n  change_me_email_not_authorized: failure=1\n  identity_added: success=1\n  password_reset_requested: noop=1\n  sign_up: success=1$/);
        assert.doesNotMatch(text, /session=/);
        assert.doesNotMatch(text, /Top event types:/);
        assert.doesNotMatch(text, /Identity types:/);
        assert.doesNotMatch(text, /Failure sources:/);
        assert.doesNotMatch(text, /Timeline by/);
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
        user_email: null,
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
