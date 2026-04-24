const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('auth_events • session_revoked', function () {

    it('should be recorded as success when another session is revoked', async function () {
        await db('auth_events').del();
        await this.add_user({username: 'mocha', password: 'pass123'});

        const cookies_a = new Map();
        const cookies_b = new Map();

        this.client.cookies = cookies_a;
        const s_a = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: s_a.csrf_token});

        this.client.cookies = cookies_b;
        const s_b = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: s_b.csrf_token});

        this.client.cookies = cookies_a;
        const status = await this.http_get_json('/auth/status');
        const session_b_uid = await (async () => { this.client.cookies = cookies_b; const s = await this.client.get_session(); this.client.cookies = cookies_a; return s.uid; })();
        await this.http_post_json('/auth/sessions/revoke', {uid: session_b_uid, _csrf: status.csrf_token});

        const events = await db('auth_events').where({event_type: const_auth_event.session_revoked}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.session_revoked,
            event_status: 'success',
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {target_session_uid: session_b_uid});
    });

    it('should be recorded as failure when revoking current session', async function () {
        await db('auth_events').del();
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        const sess = await this.client.get_session();
        await this.http_post_json('/auth/sessions/revoke', {uid: sess.uid, _csrf: status.csrf_token});

        const events = await db('auth_events').where({event_type: const_auth_event.session_revoked}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.session_revoked,
            event_status: 'failure',
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'cannot_revoke_current_session'});
    });

    it('should be recorded as noop when session uid does not belong to the user', async function () {
        await db('auth_events').del();
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sessions/revoke', {uid: 'nonexistent-session-uid', _csrf: status.csrf_token});

        const events = await db('auth_events').where({event_type: const_auth_event.session_revoked}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.session_revoked,
            event_status: 'noop',
        });
    });

});
