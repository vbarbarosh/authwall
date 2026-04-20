const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('auth_events • session_revoked_all', function () {

    it('should be recorded as success when other sessions exist', async function () {
        await db('auth_events').del();

        await this.add_user({username: 'mocha', password: 'pass123'});

        const cookies = [new Map(), new Map()];

        this.client.cookies = cookies[0];
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});

        this.client.cookies = cookies[1];
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});

        this.client.cookies = cookies[0];
        await this.http_post_json('/auth/sessions/revoke-all');

        const events = await db('auth_events').where({event_type: const_auth_event.session_revoked_all}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.session_revoked_all,
            event_status: 'success',
        });
    });

    it('should be recorded as noop when no other sessions exist', async function () {
        await db('auth_events').del();
        await this.sign_in({username: 'mocha', password: 'pass123'});

        await this.http_post_json('/auth/sessions/revoke-all');

        const events = await db('auth_events').where({event_type: const_auth_event.session_revoked_all}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.session_revoked_all,
            event_status: 'noop',
        });
    });

});
