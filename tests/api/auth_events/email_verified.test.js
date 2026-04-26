const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const normalize_email = require('../../../src/helpers/normalize/normalize_email');

describe('auth_events • email_verified', function () {

    it('should be recorded when email is verified', async function () {
        await db('auth_events').del();
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/email-verify/request');
        await this.wait_for_emails(1);

        await this.http_get_json(this.sent_emails[0].placeholders.link);

        const events = await db('auth_events').where({event_type: const_auth_event.email_verified}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.email_verified,
            event_status: 'success',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('mocha@authwall.test'),
        });
    });

});
