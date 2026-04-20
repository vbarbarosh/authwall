const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('auth_events • session_revoked_all', function () {

    it('should be recorded as success when other sessions exist', async function () {
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
        await this.http_post_json('/auth/sessions/revoke-all', {});

        const events = await db('auth_events').where({event_type: const_auth_event.session_revoked_all}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.session_revoked_all,
            event_status: 'success',
        });
    });

    it('should be recorded as noop when no other sessions exist', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/sessions/revoke-all', {});

        const events = await db('auth_events').where({event_type: const_auth_event.session_revoked_all}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.session_revoked_all,
            event_status: 'noop',
        });
    });

});
