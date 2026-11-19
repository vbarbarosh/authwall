const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const nock = require('nock').default;
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See a_borrowed_browser_signs_in_again_with_google.md.
describe('A borrowed browser signs in again with Google | stories', function () {

    beforeEach(function () {
        config.personal_access_tokens.enabled = true;
        for (const name of ['google', 'github', 'microsoft', 'facebook']) {
            config.flows[name].enabled = true;
            config.flows[name].client_id = `mocha_${name}_client_id`;
            config.flows[name].redirect_url = `mocha_${name}_redirect_url`;
        }
    });

    async function link(user_id, type, sub) {
        const now = new Date();
        await db('user_identities').insert({uid: random_uid_user_identity(), user_id, type, value: sub, value_normalized: sub, created_at: now, updated_at: now, verified_at: now});
    }

    // "Sign in again with Google": the provider, still signed in, answers at
    // once with the given account.
    async function sign_in_again_with_google(ctx, sub) {
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {sub, name: 'Ann', picture: null, email: null, email_verified: false});
        await ctx.client.get_json_no_redirects('/auth/google?confirm=1');
        const {oauth_state} = await ctx.client.get_session();
        await ctx.client.get_json_no_redirects(urlmod('/auth/google/callback', {state: oauth_state, code: 'fake_code'})).catch(e => e.response);
        return ctx.http_get_json('/auth/status');
    }

    async function sign_in_again_with_github(ctx, id) {
        nock('https://github.com').post('/login/oauth/access_token').reply(200, {access_token: 'fake-token', token_type: 'bearer', scope: 'user:email'});
        nock('https://api.github.com').get('/user').reply(200, {id, name: 'Gil', avatar_url: null});
        nock('https://api.github.com').get('/user/emails').reply(200, []);
        await ctx.client.get_json_no_redirects('/auth/github?confirm=1');
        const {oauth_state} = await ctx.client.get_session();
        await ctx.client.get_json_no_redirects(urlmod('/auth/github/callback', {state: oauth_state, code: 'fake_code'})).catch(e => e.response);
        return ctx.http_get_json('/auth/status');
    }

    it('Mallory at Ann\'s laptop clicks Google: refused, and no token is made (AW-123)', async function () {
        const {user_id} = await this.sign_in({username: 'ann', password: 'anns-pass-123'});
        await link(user_id, const_user_identity.oauth_google, 'ann-google');

        await this.http_post_json('/auth/personal-access-tokens', {label: 'mallory'});
        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Confirm it is you before creating a token');

        const status = await sign_in_again_with_google(this, 'ann-google');
        assert.strictEqual(status.error, 'Confirm with your password.');
        assert.strictEqual(status.confirmed, false);

        await this.http_post_json('/auth/personal-access-tokens', {label: 'mallory'});
        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Confirm it is you before creating a token');
        assert.strictEqual((await db('personal_access_tokens').where({user_id})).length, 0);
    });

    it('Gil, with GitHub and no password, still confirms with GitHub', async function () {
        const {user_id} = await this.sign_in({username: 'gil', password: 'gils-pass-123'});
        await db('user_identities').where({user_id}).delete();
        await db('users').where({id: user_id}).update({password_hash: null});
        await link(user_id, const_user_identity.oauth_github, '777');

        await this.http_post_json('/auth/personal-access-tokens', {label: 'ci'});
        const status = await sign_in_again_with_github(this, 777);
        assert.strictEqual(status.confirmed, true);
        const {token} = await this.http_post_json('/auth/personal-access-tokens', {label: 'ci'});
        assert.match(token, /^awp_/);
    });

    it('removing Ann\'s account takes her password alone: Google is no second way', async function () {
        const {user_id} = await this.sign_in({username: 'ann', password: 'anns-pass-123'});
        await link(user_id, const_user_identity.oauth_google, 'ann-google');

        await this.http_post_json('/auth/account/remove', {confirmation: 'DELETE'});
        assert.deepStrictEqual((await this.http_get_json('/auth/status')).confirmation, {next: config.pages.profile, reason: 'account_remove', factors: 1});
    });

    it('asks Microsoft and Facebook for a new sign-in at a confirmation, and not at a sign-in', async function () {
        for (const [route, name, value] of [['/auth/microsoft', 'prompt', 'login'], ['/auth/facebook', 'auth_type', 'reauthenticate']]) {
            const confirm = await this.client.get_json_no_redirects(`${route}?confirm=1`);
            assert.strictEqual(new URL(confirm.headers.location).searchParams.get(name), value, route);
            const sign_in = await this.client.get_json_no_redirects(route);
            assert.notStrictEqual(new URL(sign_in.headers.location).searchParams.get(name), value, route);
        }
    });

});
