const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const db = require('../../../db');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// AW-24: see oauth_link_survives_reset.md. The attack case fails until the
// primary-address rule is built (step 10 of notes/audit-2026-09-28.md).
describe('A link planted from a borrowed session survives the owner\'s recovery | stories', function () {

    beforeEach(function () {
        config.flows.password.min_password_length = 4;
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    async function google_callback(ctx, route, {sub, email}) {
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {sub, name: 'Google User', picture: null, email, email_verified: true});
        await ctx.client.get_json_no_redirects(route);
        const sess = await ctx.client.get_session();
        await ctx.http_get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
    }

    async function google_subs() {
        return db('user_identities').where({type: 'oauth_google'}).pluck('value_normalized');
    }

    it('the attacker\'s Google account never signs in as Mocha', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        const mocha = await this.client.get_session();

        // 1. A borrowed session connects the attacker's own Google account:
        // nothing is linked, and a code goes to Mocha's primary address.
        await google_callback(this, '/auth/google?connect=1', {sub: 'attacker-google', email: 'attacker@gmail.test'});
        assert.deepStrictEqual(await google_subs(), [], 'the attacker\'s Google account was linked without confirmation');
        await this.wait_for_emails(1);
        assert.ok(this.sent_emails.some(v => (v.to === 'mocha@authwall.test') && v.placeholders?.code), 'no code was mailed to the primary address');

        // 2. Mocha resets the password from a fresh browser.
        this.client.cookies.clear();
        await this.http_post_json('/auth/password-reset/request', {email: 'mocha@authwall.test'});
        const {token} = this.sent_emails.find(v => v.name === const_email.password_reset).placeholders;
        await this.http_post_json('/auth/password-reset/confirm', {token, password: 'pass456', password_confirm: 'pass456'});
        assert.strictEqual((await this.http_get_json('/auth/status')).error, null);

        // 3. The attacker comes back through Google.
        this.client.cookies.clear();
        await google_callback(this, '/auth/google', {sub: 'attacker-google', email: 'attacker@gmail.test'});
        const attacker = await this.client.get_session();
        assert.notStrictEqual(attacker?.user_uid, mocha.user_uid, 'the attacker is signed in as Mocha');
    });

    it('links a Google account that returns the primary address at once', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});

        await google_callback(this, '/auth/google?connect=1', {sub: 'mocha-google', email: 'mocha@authwall.test'});
        assert.strictEqual((await this.http_get_json('/auth/status')).error, null);
        assert.deepStrictEqual(await google_subs(), ['mocha-google']);
    });

});
