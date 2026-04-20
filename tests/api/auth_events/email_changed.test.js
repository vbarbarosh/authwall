const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const normalize_email = require('../../../src/helpers/normalize/normalize_email');

describe('auth_events • email_changed', function () {

    it('should be recorded when email change is confirmed', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/email-change/request', {email: 'new@authwall.test'});
        await this.wait_for_emails(1);

        await this.http_get_json(this.sent_emails[0].placeholders.confirm_link);

        const events = await db('auth_events').where({event_type: const_auth_event.email_changed}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.email_changed,
            event_status: 'success',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('new@authwall.test'),
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {old_email: 'mocha@authwall.test'});
    });

});
