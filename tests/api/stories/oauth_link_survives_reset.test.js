const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// AW-24: see oauth_link_survives_reset.md. Fails until step 10 of
// notes/audit-2026-09-28.md decides what a reset does to linked accounts.
describe('A link planted from a borrowed session survives the owner\'s recovery | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    async function google_callback(ctx, sub, route) {
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {sub, name: 'Attacker', picture: null, email: null, email_verified: false});
        await ctx.client.get_json_no_redirects(route);
        const sess = await ctx.client.get_session();
        await ctx.http_get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
    }

    it('the attacker\'s Google account no longer signs in as Mocha after the reset', async function () {
        config.flows.password.min_password_length = 4;
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        const mocha = await this.client.get_session();

        // 1. A borrowed session links the attacker's own Google account.
        await google_callback(this, 'attacker-google', '/auth/google?connect=1');
        assert.strictEqual((await this.http_get_json('/auth/status')).error, null);

        // 2. Mocha is told to reset the password.
        await this.wait_for_emails(1);
        assert.strictEqual(this.sent_emails[0].name, const_email.google_connected);

        // 3. Mocha resets it from a fresh browser.
        this.client.cookies.clear();
        await this.http_post_json('/auth/password-reset/request', {email: 'mocha@authwall.test'});
        const {token} = this.sent_emails.find(v => v.name === const_email.password_reset).placeholders;
        await this.http_post_json('/auth/password-reset/confirm', {token, password: 'pass456', password_confirm: 'pass456'});
        assert.strictEqual((await this.http_get_json('/auth/status')).error, null);

        // 4. The attacker comes back through Google.
        this.client.cookies.clear();
        await google_callback(this, 'attacker-google', '/auth/google');
        const attacker = await this.client.get_session();
        assert.notStrictEqual(attacker?.user_uid, mocha.user_uid, 'the attacker is signed in as Mocha');
    });

});
