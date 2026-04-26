const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const normalize_email = require('../../../src/helpers/normalize/normalize_email');

describe('auth_events • email_verification_requested', function () {

    it('should be recorded as success when verification email is sent', async function () {
        await db('auth_events').del();
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/email-verify/request');
        await this.wait_for_emails(1);

        const events = await db('auth_events').where({event_type: const_auth_event.email_verification_requested}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.email_verification_requested,
            event_status: 'success',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('mocha@authwall.test'),
        });
    });

    it('should be recorded as noop when no unverified email exists', async function () {
        await db('auth_events').del();
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/email-verify/request');

        const events = await db('auth_events').where({event_type: const_auth_event.email_verification_requested}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.email_verification_requested,
            event_status: 'noop',
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'no_unverified_email'});
    });

    it('should be recorded as noop when rate-limited', async function () {
        await db('auth_events').del();
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/email-verify/request');
        await this.wait_for_emails(1);

        // second request within rate-limit window
        await this.http_post_json('/auth/email-verify/request');

        const events = await db('auth_events').where({event_type: const_auth_event.email_verification_requested}).orderBy('id');
        assert.strictEqual(events.length, 2);
        assert.partialDeepStrictEqual(events[1], {
            event_type: const_auth_event.email_verification_requested,
            event_status: 'noop',
        });
        assert.partialDeepStrictEqual(JSON.parse(events[1].custom), {reason: 'verification_email_already_sent'});
    });

});
