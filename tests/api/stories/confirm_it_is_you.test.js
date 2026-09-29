const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See confirm_it_is_you.md.
describe('Confirm it is you | stories', function () {

    beforeEach(function () {
        config.flows.password.min_password_length = 4;
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.flows.github.enabled = true;
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    // Goes through Google with the given account and returns the callback's
    // redirect, without following it.
    async function google(ctx, route, sub) {
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {sub, name: 'Google User', picture: null, email: null, email_verified: false});
        await ctx.client.get_json_no_redirects(route);
        const sess = await ctx.client.get_session();
        const r = await ctx.client.get_json_no_redirects(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'})).catch(error => error.response);
        return r.headers.location;
    }

    async function request_code(ctx) {
        await ctx.http_post_json('/auth/confirm/request');
        await ctx.wait_for_emails(1);
        const sent = ctx.sent_emails.find(v => v.name === const_email.confirm_code);
        assert.ok(sent, (await ctx.http_get_json('/auth/status')).error ?? 'no code was mailed');
        return sent;
    }

    async function confirm(ctx, fields) {
        await ctx.http_post_json('/auth/confirm', fields);
        const status = await ctx.http_get_json('/auth/status');
        const session = await ctx.client.get_session();
        return {error: status.error, confirmed_at: session.confirmed_at ?? null};
    }

    it('confirms with a code mailed to the primary address', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        const sent = await request_code(this);
        assert.strictEqual(sent.to, 'mocha@authwall.test');

        const r = await confirm(this, {code: sent.placeholders.code});
        assert.strictEqual(r.error, null);
        assert.ok(r.confirmed_at);
    });

    it('confirms with the password', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        const r = await confirm(this, {password: 'pass123'});
        assert.strictEqual(r.error, null);
        assert.ok(r.confirmed_at);
    });

    it('refuses a wrong password and a wrong code', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        assert.deepStrictEqual(await confirm(this, {password: 'wrong'}), {error: 'Password is incorrect', confirmed_at: null});
        await request_code(this);
        assert.deepStrictEqual(await confirm(this, {code: '000000'}), {error: 'Invalid or expired code', confirmed_at: null});
    });

    it('refuses even the right answer after five failures', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        await request_code(this);
        for (const fields of [{code: '000000'}, {password: 'wrong'}, {code: '000000'}, {password: 'wrong'}, {code: '000000'}]) {
            await confirm(this, fields);
        }
        assert.deepStrictEqual(await confirm(this, {password: 'pass123'}), {error: 'Too many attempts. Try again later.', confirmed_at: null});
    });

    it('asks an account with no primary address for its password', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/confirm/request');
        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Your account has no primary address. Confirm with your password.');
        assert.strictEqual(this.sent_emails.length, 0);

        assert.strictEqual((await confirm(this, {password: 'pass123'})).error, null);
    });

    it('asks an account with no password for a code', async function () {
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: this.sent_emails[0].placeholders.code});
        const r = await confirm(this, {password: 'anything'});
        assert.strictEqual(r.error, 'Your account has no password. Confirm with a code sent to your primary address.');
        assert.strictEqual(r.confirmed_at, null);
    });

    it('starts a new sign-in unconfirmed', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        assert.ok((await confirm(this, {password: 'pass123'})).confirmed_at);

        await this.http_post_json('/auth/sign-out');
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});
        const session = await this.client.get_session();
        assert.ok(session.user_uid);
        assert.strictEqual(session.confirmed_at, undefined);
    });

    it('confirms with a fresh sign-in through a linked provider', async function () {
        await google(this, '/auth/google', 'mocha-google');
        assert.strictEqual((await this.client.get_session()).confirmed_at, undefined);

        await google(this, '/auth/google?confirm=1', 'mocha-google');
        assert.ok((await this.client.get_session()).confirmed_at);
    });

    it('refuses a provider account that is not linked to this user', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await google(this, '/auth/google?confirm=1', 'someone-else');

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'This account is not linked to yours. Sign in with an account you have linked.');
        assert.strictEqual(status.confirmed, false);
    });

    it('continues to the pending connect after a provider confirms', async function () {
        await google(this, '/auth/google', 'mocha-google');
        nock('https://github.com').post('/login/oauth/access_token').reply(200, {access_token: 'fake-token', token_type: 'bearer', scope: 'user:email'});
        nock('https://api.github.com').get('/user').reply(200, {id: 777, name: 'GitHub User', avatar_url: null});
        nock('https://api.github.com').get('/user/emails').reply(200, []);
        await this.client.get_json_no_redirects('/auth/github?connect=1');
        const sess = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/github/callback', {state: sess.oauth_state, code: 'fake_code'}));
        assert.strictEqual((await this.http_get_json('/auth/status')).confirmation.next, '/auth/github?connect=1');

        assert.strictEqual(await google(this, '/auth/google?confirm=1', 'mocha-google'), '/auth/github?connect=1');
    });

});
