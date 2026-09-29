const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('auth_events • email_change_approved', function () {

    it('should be recorded when the current primary approves a change', async function () {
        const {user_id} = await this.sign_in({email: 'old@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/email-change/request', {email: 'new@authwall.test'});
        await this.approve_email_change();

        const events = await db('auth_events').where({event_type: const_auth_event.email_change_approved}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            user_id,
            event_status: 'success',
            identity_value_normalized: 'new@authwall.test',
        });
    });

});
