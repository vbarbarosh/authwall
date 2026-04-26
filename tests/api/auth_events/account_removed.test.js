const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('auth_events • account_removed', function () {

    it('should be recorded when account is removed', async function () {
        await db('auth_events').del();

        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/account/remove', {confirmation: 'DELETE'});

        const events = await db('auth_events').where({event_type: const_auth_event.account_removed}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.account_removed,
            event_status: 'success',
            user_id: null,
            identity_value: status.user_uid,
            identity_value_normalized: status.user_uid,
        });
    });

});
