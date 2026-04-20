const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('auth_events • password_reset_completed', function () {

    it('should be recorded when password reset is completed', async function () {
        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/password-reset/request', {email: 'mocha@authwall.test'});
        await this.wait_for_emails(1);

        await this.http_post_json('/auth/password-reset/confirm', {
            token: this.sent_emails[0].placeholders.token,
            password: 'newpass123',
            password_confirm: 'newpass123',
        });

        const events = await db('auth_events').where({event_type: const_auth_event.password_reset_completed}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.password_reset_completed,
            event_status: 'success',
        });
    });

});
