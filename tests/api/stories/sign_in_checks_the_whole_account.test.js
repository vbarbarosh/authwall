const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const nock = require('nock');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

function mock_github(id, email)
{
    nock('https://github.com')
        .post('/login/oauth/access_token')
        .reply(200, {access_token: 'fake-token', token_type: 'bearer', scope: 'user:email'});
    nock('https://api.github.com')
        .get('/user')
        .reply(200, {id, name: 'GitHub User', avatar_url: null});
    nock('https://api.github.com')
        .get('/user/emails')
        .reply(200, [{email, primary: true, verified: true, visibility: 'private'}]);
}

// See sign_in_checks_the_whole_account.md.
describe('Sign-in checks every address on the account | stories', function () {

    beforeEach(async function () {
        config.access.allowed_domains = ['corp.test'];
        config.access.denied_emails = ['bad@corp.test'];
        config.flows.github.enabled = true;
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
        config.flows.magic_link.mode = 'code';
    });

    afterEach(function () {
        nock.cleanAll();
    });

    async function add_account(_this) {
        const {user_id} = await _this.add_user({email: 'bad@corp.test', password: 'pass1234'});
        const now = new Date();
        const base = {user_id, created_at: now, updated_at: now, verified_at: now};
        await db('user_identities').insert([
            {...base, uid: random_uid_user_identity(), type: const_user_identity.email, value: 'good@corp.test', value_normalized: 'good@corp.test'},
            {...base, uid: random_uid_user_identity(), type: const_user_identity.oauth_github, value: '777', value_normalized: '777'},
        ]);
    }

    async function sign_in_with_github(_this) {
        mock_github(777, 'new@corp.test');
        await _this.client.get_json_no_redirects('/auth/github');
        const sess = await _this.client.get_session();
        await _this.client.get_json(urlmod('/auth/github/callback', {state: sess.oauth_state, code: 'fake_code'}));
        return _this.http_get_json('/auth/status');
    }

    async function sign_in_with_password(_this) {
        await _this.http_post_json('/auth/sign-in', {username: 'good@corp.test', password: 'pass1234'});
        return _this.http_get_json('/auth/status');
    }

    async function sign_in_with_magic_code(_this) {
        await _this.http_post_json('/auth/magic-link/request', {email: 'good@corp.test'});
        const {code} = _this.sent_emails.at(-1).placeholders;
        await _this.http_post_json('/auth/magic-link/confirm', {email: 'good@corp.test', code});
        return _this.http_get_json('/auth/status');
    }

    it('refuses GitHub with a new address at the provider', async function () {
        await add_account(this);
        assert.partialDeepStrictEqual(await sign_in_with_github(this), {authenticated: false, error: 'Email is not allowed'});
    });

    it('refuses email and password with an allowed address, as a wrong password', async function () {
        await add_account(this);
        assert.partialDeepStrictEqual(await sign_in_with_password(this), {authenticated: false, error: 'Invalid username or password'});
    });

    it('refuses a magic link to an allowed address', async function () {
        await add_account(this);
        assert.partialDeepStrictEqual(await sign_in_with_magic_code(this), {authenticated: false, error: 'Email is not allowed'});
    });

    it('admits the same account through each of them without the deny rule', async function () {
        config.access.denied_emails = [];
        await add_account(this);
        for (const sign_in of [sign_in_with_github, sign_in_with_password, sign_in_with_magic_code]) {
            assert.strictEqual((await sign_in(this)).authenticated, true, sign_in.name);
            await this.http_post_json('/auth/sign-out');
        }
    });

});
