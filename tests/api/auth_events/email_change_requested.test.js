const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const normalize_email = require('../../../src/helpers/normalize/normalize_email');

describe('auth_events • email_change_requested', function () {

    it('should be recorded as success when change is requested', async function () {
        await db('auth_events').del();
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/email-change/request', {email: 'new@authwall.test'});
        await this.wait_for_emails(1);

        const events = await db('auth_events').where({event_type: const_auth_event.email_change_requested}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.email_change_requested,
            event_status: 'success',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('new@authwall.test'),
        });
    });

    it('should be recorded as failure when new email is already registered', async function () {
        await db('auth_events').del();
        await this.add_user({email: 'taken@authwall.test', password: 'pass123'});
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/email-change/request', {email: 'taken@authwall.test'});

        const events = await db('auth_events').where({event_type: const_auth_event.email_change_requested}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.email_change_requested,
            event_status: 'failure',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('taken@authwall.test'),
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'email_already_registered'});
    });

    it('should be recorded as noop when rate-limited', async function () {
        await db('auth_events').del();
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/email-change/request', {email: 'new@authwall.test'});
        await this.wait_for_emails(1);

        // second request within rate-limit window
        await this.http_post_json('/auth/email-change/request', {email: 'new@authwall.test'});

        const events = await db('auth_events').where({event_type: const_auth_event.email_change_requested}).orderBy('id');
        assert.strictEqual(events.length, 2);
        assert.partialDeepStrictEqual(events[1], {
            event_type: const_auth_event.email_change_requested,
            event_status: 'noop',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('new@authwall.test'),
        });
        assert.partialDeepStrictEqual(JSON.parse(events[1].custom), {reason: 'email_changed_already_requested'});
    });

});
