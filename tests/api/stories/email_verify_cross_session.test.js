const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const normalize_email = require('../../../src/helpers/normalize/normalize_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// A verification link belongs to its token owner, not to whichever browser
// happens to open it.
describe('Email verification link opened in another session | stories', function () {

    it('verifies the token owner without changing the current session email fields', async function () {
        config.email_verification.required = true;

        const cookies_a = new Map();
        const cookies_b = new Map();

        this.client.cookies = cookies_a;
        await this.sign_in({email: 'alice@authwall.test', password: 'pass123', verified: true});
        const alice_session = await this.client.get_session();
        assert.strictEqual(alice_session.email, 'alice@authwall.test');
        assert.match(alice_session.email_verified_at, /^\d{4}-\d{2}-\d{2}T/);

        this.client.cookies = cookies_b;
        const {user_id: bob_user_id} = await this.sign_in({email: 'bob@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/email-verify/request');
        await this.wait_for_emails(1);
        const {link} = this.sent_emails.find(e => e.placeholders?.link).placeholders;
        const token = new URL(link).searchParams.get('token');

        this.client.cookies = cookies_a;
        await this.http_get_json(urlmod(config.pages.email_verify_confirm, {token}));

        const alice_session_after = await this.client.get_session();
        assert.strictEqual(alice_session_after.email, 'alice@authwall.test');
        assert.strictEqual(alice_session_after.email_verified_at, alice_session.email_verified_at);

        const bob_email = await db('user_identities')
            .where({
                user_id: bob_user_id,
                type: const_user_identity.email,
                value_normalized: normalize_email('bob@authwall.test'),
            })
            .first();
        assert.ok(bob_email.verified_at);
    });

});
