const assert = require('assert');
const config = require('../../../config');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

function mock_github({id = 'github-sub-only'} = {})
{
    nock('https://github.com')
        .post('/login/oauth/access_token')
        .reply(200, {
            access_token: 'fake-token', expires_in: 28800, refresh_token: 'ghr_xxx',
            refresh_token_expires_in: 15811200, token_type: 'bearer', scope: 'user:email',
        });

    nock('https://api.github.com')
        .get('/user')
        .reply(200, {id, name: 'GitHub User', avatar_url: null});

    nock('https://api.github.com')
        .get('/user/emails')
        .reply(200, []);
}

// A user must not be able to remove their only sign-in method,
// which would permanently lock them out of their account.
describe('Last auth method cannot be removed | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.flows.github.enabled = true;
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    afterEach(function () {
        config.flows.google.enabled = false;
        config.flows.github.enabled = false;
    });

    async function sign_in_via_google(client, {sub = 'google-only-sub', email = null} = {}) {
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {
            sub,
            name: 'Test User',
            picture: null,
            email,
            email_verified: email !== null,
        });
        await client.get_json_no_redirects('/auth/google');
        const sess = await client.get_session();
        await client.get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
    }

    it('blocks disconnecting Google when it is the only identity', async function () {
        await sign_in_via_google(this.client, {sub: 'google-only-sub'});

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);
        assert.strictEqual(status.providers.length, 1);

        await this.http_post_json('/auth/google/disconnect', {_csrf: status.csrf_token});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Cannot disconnect Google: it is your only sign-in method');
        assert.ok(status2.providers.find(v => v.type === 'oauth_google'));
    });

    it('allows disconnecting Google when a second identity exists', async function () {
        // Sign up via Google with a verified email — creates two identities: oauth_google + email
        await sign_in_via_google(this.client, {sub: 'google-with-email-sub', email: 'googleuser@authwall.test'});

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);
        assert.strictEqual(status.providers.length, 2);

        await this.http_post_json('/auth/google/disconnect', {_csrf: status.csrf_token});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.providers.find(v => v.type === 'oauth_google'), undefined);
        assert.ok(status2.providers.find(v => v.type === 'email'));
    });

    it('blocks disconnecting GitHub when Google was disconnected and GitHub is the last identity', async function () {
        // Sign up via Google (no email) → connect GitHub → disconnect Google → only GitHub remains
        await sign_in_via_google(this.client, {sub: 'google-sub-chain'});

        mock_github();
        await this.client.get_json_no_redirects('/auth/github?connect=1');
        const sess_gh = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/github/callback', {state: sess_gh.oauth_state, code: 'fake_code'}));

        const s = await this.http_get_json('/auth/status');
        assert.strictEqual(s.providers.length, 2);

        await this.http_post_json('/auth/google/disconnect', {_csrf: s.csrf_token});
        const s2 = await this.http_get_json('/auth/status');
        assert.strictEqual(s2.providers.length, 1);
        assert.strictEqual(s2.providers[0].type, 'oauth_github');

        await this.http_post_json('/auth/github/disconnect', {_csrf: s2.csrf_token});
        const s3 = await this.http_get_json('/auth/status');
        assert.strictEqual(s3.error, 'Cannot disconnect GitHub: it is your only sign-in method');
        assert.ok(s3.providers.find(v => v.type === 'oauth_github'));
    });

});
