const assert = require('assert');
const config = require('../../../config');
const nock = require('nock').default;
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See sign_in_returns_to_the_page_asked_for.md.
describe('A sign-in by email or by a provider returns to the page asked for | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.client_secret = 'mocha_google_client_secret';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    async function post_no_redirects(ctx, url, data) {
        const {csrf_token} = await ctx.http_get_json('/auth/status');
        return ctx.client.post_json_no_redirects(url, {...data, _csrf: csrf_token});
    }

    async function sign_in_via_google(ctx, return_url) {
        nock('https://oauth2.googleapis.com')
            .post('/token')
            .reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com')
            .get('/oauth2/v3/userinfo')
            .reply(200, {sub: 'google-ann', name: 'Ann', picture: null, email: 'ann@authwall.test', email_verified: true});
        await ctx.client.get_json_no_redirects(urlmod('/auth/google', {return: return_url}));
        const sess = await ctx.client.get_session();
        return ctx.client.get_json_no_redirects(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
    }

    it('lands a sign-in by code on the page asked for', async function () {
        await this.add_user({email: 'ann@authwall.test'});

        const requested = await post_no_redirects(this, '/auth/magic-link/request?return=%2Freports', {email: 'ann@authwall.test'});
        assert.strictEqual(requested.headers.location, urlmod(config.pages.magic_link_notice, {email: 'ann@authwall.test'}));

        const {code} = this.sent_emails[0].placeholders;
        const signed_in = await post_no_redirects(this, '/auth/magic-link/confirm?return=%2Freports', {email: 'ann@authwall.test', code});
        assert.strictEqual(signed_in.headers.location, '/reports');
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);
    });

    it('lands a sign-in by the mailed link on the page asked for', async function () {
        await this.add_user({email: 'ann@authwall.test'});

        await post_no_redirects(this, '/auth/magic-link/request?return=%2Freports', {email: 'ann@authwall.test'});
        const link = new URL(this.sent_emails[0].placeholders.link);
        assert.strictEqual(link.searchParams.get('return'), '/reports');

        const opened = await post_no_redirects(this, urlmod(`${link.pathname}/open`, {return: link.searchParams.get('return')}), {token: link.searchParams.get('token')});
        assert.strictEqual(opened.headers.location, '/reports');
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);
    });

    it('mails no return to another site', async function () {
        await this.add_user({email: 'ann@authwall.test'});

        await post_no_redirects(this, '/auth/magic-link/request?return=http%3A%2F%2Fevil.test%2Fx', {email: 'ann@authwall.test'});
        const link = new URL(this.sent_emails[0].placeholders.link);
        assert.strictEqual(link.searchParams.get('return'), null);
    });

    it('lands a Google sign-in on the page asked for', async function () {
        const callback = await sign_in_via_google(this, '/reports');
        assert.strictEqual(callback.headers.location, '/reports');
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);
    });

    it('lands a Google sign-in asked to return to another site on /', async function () {
        const callback = await sign_in_via_google(this, 'http://evil.test/x');
        assert.strictEqual(callback.headers.location, '/');
    });

});
