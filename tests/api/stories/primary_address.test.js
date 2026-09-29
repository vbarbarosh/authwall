const assert = require('assert');
const config = require('../../../config');
const db = require('../../../db');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See primary_address.md.
describe('The primary address | stories', function () {

    beforeEach(function () {
        config.flows.password.min_password_length = 4;
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    async function primary_addresses() {
        return db('user_identities').whereNotNull('primary_at').orderBy('id').pluck('value_normalized');
    }

    async function google_callback(ctx, route, {sub, email}) {
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {sub, name: 'Google User', picture: null, email, email_verified: true});
        await ctx.client.get_json_no_redirects(route);
        const sess = await ctx.client.get_session();
        await ctx.http_get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
    }

    it('makes a signed-up address primary once it is confirmed', async function () {
        await this.http_post_json('/auth/sign-up', {email: 'mocha@authwall.test', password: 'pass123', password_confirm: 'pass123'});
        await this.wait_for_emails(1);
        assert.deepStrictEqual(await primary_addresses(), []);

        const link = new URL(this.sent_emails[0].placeholders.link);
        await this.http_get_json(link.pathname + link.search);
        assert.deepStrictEqual(await primary_addresses(), ['mocha@authwall.test']);

        const status = await this.http_get_json('/auth/status');
        assert.ok(status.providers.find(v => v.value_normalized === 'mocha@authwall.test').primary_at);
    });

    it('makes the address of a magic-link sign-up primary at once', async function () {
        await this.http_post_json('/auth/magic-link/request', {email: 'alice@authwall.test'});
        const {code} = this.sent_emails[0].placeholders;
        await this.http_post_json('/auth/magic-link/confirm', {email: 'alice@authwall.test', code});
        assert.deepStrictEqual(await primary_addresses(), ['alice@authwall.test']);
    });

    it('makes the verified address of a Google sign-up primary at once', async function () {
        await google_callback(this, '/auth/google', {sub: 'alice-google', email: 'alice@authwall.test'});
        assert.deepStrictEqual(await primary_addresses(), ['alice@authwall.test']);
    });

    it('keeps the primary when a provider adds another address', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        await google_callback(this, '/auth/google?connect=1', {sub: 'mocha-google', email: 'mocha@gmail.test'});

        const emails = await db('user_identities').where({type: 'email'}).orderBy('id').pluck('value_normalized');
        assert.deepStrictEqual(emails, ['mocha@authwall.test', 'mocha@gmail.test']);
        assert.deepStrictEqual(await primary_addresses(), ['mocha@authwall.test']);
    });

    it('moves the primary to the new value of a changed address', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json(config.pages.email_change_request, {email: 'mocha@new.test'});
        const {token} = this.sent_emails.find(v => v.to === 'mocha@new.test').placeholders;
        await this.http_get_json(urlmod(config.pages.email_change_confirm, {token}));

        assert.deepStrictEqual(await primary_addresses(), ['mocha@new.test']);
    });

});
