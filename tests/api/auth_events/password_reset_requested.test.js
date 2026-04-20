const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const normalize_email = require('../../../src/helpers/normalize/normalize_email');

describe('auth_events • password_reset_requested', function () {

    it('should be recorded as success when email is found', async function () {
        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/password-reset/request', {email: 'mocha@authwall.test'});
        await this.wait_for_emails(1);

        const events = await db('auth_events').where({event_type: const_auth_event.password_reset_requested}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.password_reset_requested,
            event_status: 'success',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('mocha@authwall.test'),
        });
    });

    it('should be recorded as noop when email is not found', async function () {
        await this.http_post_json('/auth/password-reset/request', {email: 'ghost@authwall.test'});

        const events = await db('auth_events').where({event_type: const_auth_event.password_reset_requested}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.password_reset_requested,
            event_status: 'noop',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('ghost@authwall.test'),
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'email_not_found'});
    });

});
