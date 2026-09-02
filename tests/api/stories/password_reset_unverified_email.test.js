const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('Password reset and an unverified address | stories', function () {

    it('sends nothing to an address nobody has verified, and answers like an unknown one', async function () {
        await this.add_user({email: 'pending@authwall.test', password: 'pass123', verified: false});

        await this.http_post_json('/auth/password-reset/request', {email: 'pending@authwall.test'});

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, null);
        assert.deepStrictEqual(this.sent_emails, []);

        const event = await db('auth_events').where({event_type: const_auth_event.password_reset_requested}).orderBy('id', 'desc').first();
        assert.strictEqual(JSON.parse(event.custom).reason, 'email_not_verified');
    });

    describe('with personal access tokens enabled', function () {
        beforeEach(function () {
            config.personal_access_tokens.enabled = true;
        });

    it('revokes personal access tokens when the password is reset', async function () {
        const {user_id} = await this.sign_in({email: 'owner@authwall.test', password: 'pass123', verified: true});
        const created = await this.http_post_json('/auth/personal-access-tokens', {label: 'laptop'});
        await this.http_post_json('/auth/sign-out');
        this.client.cookies.clear();
        this.sent_emails.splice(0);

        await this.http_post_json('/auth/password-reset/request', {email: 'owner@authwall.test'});
        await this.wait_for_emails(1);
        const {token} = this.sent_emails[0].placeholders;
        await this.http_post_json('/auth/password-reset/confirm', {token, password: 'newpass123', password_confirm: 'newpass123'});

        const row = await db('personal_access_tokens').where({user_id}).first();
        assert.ok(row.revoked_at, 'token should be revoked');

        const r = await axios.get('/auth/status', {baseURL: config.public_url, headers: {Authorization: `Bearer ${created.token}`}, validateStatus: () => true});
        assert.strictEqual(r.status, 401);
    });
    });

});
