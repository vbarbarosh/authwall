const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See confirmation_is_spent_once.md.
describe('A confirmation covers the action that asked for it, once | stories', function () {

    beforeEach(function () {
        config.flows.password.min_password_length = 4;
        config.personal_access_tokens.enabled = true;
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    // Connects a Google account that does not use the primary address, so the
    // connect needs a confirmation (AW-24).
    async function connect_google(ctx, sub, email) {
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {sub, name: 'Google User', picture: null, email, email_verified: true});
        await ctx.client.get_json_no_redirects('/auth/google?connect=1');
        const sess = await ctx.client.get_session();
        await ctx.client.get_json_no_redirects(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
    }

    function google_subs() {
        return db('user_identities').where({type: const_user_identity.oauth_google}).pluck('value_normalized');
    }

    it('the owner confirms to create a token; a second token asks again', async function () {
        await this.sign_in({username: 'ann', email: 'ann@authwall.test', password: 'anns-pass'});

        await this.http_post_json('/auth/personal-access-tokens', {label: 'ci'});
        await this.confirm({password: 'anns-pass'});
        assert.match((await this.http_post_json('/auth/personal-access-tokens', {label: 'ci'})).token, /^awp_/);

        await this.http_post_json('/auth/personal-access-tokens', {label: 'second'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Confirm it is you before creating a token');
        assert.strictEqual((await db('personal_access_tokens')).length, 1);
    });

    it('the owner confirms to remove an address; within the ten minutes a borrower links Google, and is asked (AW-81)', async function () {
        await this.sign_in({username: 'ann', email: 'ann@authwall.test', password: 'anns-pass'});
        await this.http_post_json('/auth/email/add', {email: 'second@authwall.test'});

        // Ann is asked, confirms, and leaves before removing anything.
        await this.http_post_json('/auth/email/remove');
        await this.confirm({password: 'anns-pass'});
        assert.strictEqual((await this.http_get_json('/auth/status')).confirmed, true);

        // At the same browser, a borrower links their own Google account.
        await connect_google(this, 'attacker-google', 'attacker@gmail.test');
        assert.deepStrictEqual(await google_subs(), []);
        assert.strictEqual((await this.http_get_json('/auth/status')).confirmation.reason, 'provider_connect');
    });

    it('a confirmation asked for linking one Google account links it, once', async function () {
        await this.sign_in({username: 'ann', email: 'ann@authwall.test', password: 'anns-pass'});

        await connect_google(this, 'ann-google', 'ann@gmail.test');
        await this.confirm({password: 'anns-pass'});
        await connect_google(this, 'ann-google', 'ann@gmail.test');
        assert.deepStrictEqual(await google_subs(), ['ann-google']);
        assert.strictEqual((await this.http_get_json('/auth/status')).confirmed, false);
    });

});
