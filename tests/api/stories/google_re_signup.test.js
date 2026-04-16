const assert = require('assert');
const config = require('../../../config');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

function mock_google({sub = 'google-sub-123', email = null} = {})
{
    nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, {access_token: 'fake-token'});

    nock('https://www.googleapis.com')
        .get('/oauth2/v3/userinfo')
        .reply(200, {sub, name: 'Test User', picture: null, email, email_verified: email !== null});
}

// Edge case: user signed up using Google, then connected GitHub, then disconnected Google.
// Later, sign-up with the same Google account should create a brand-new user.
// If the email is already attached to another user, the new Google-only account is created without email.
describe('Google re-signup after disconnect | stories', function () {

    beforeEach(function () {
        config.flows.github.enabled = true;
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    afterEach(function () {
        config.flows.github.enabled = false;
        config.flows.google.enabled = false;
    });

    async function sign_in_via_google(client, opts) {
        mock_google(opts);
        await client.get_json_no_redirects('/auth/google');
        const sess = await client.get_session();
        await client.get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
    }

    it('creates a new user when the disconnected Google account signs up again', async function () {
        // Sign up via Google with email
        await sign_in_via_google(this.client, {sub: 'google-sub-123', email: 'google-user@authwall.test'});
        const status1 = await this.http_get_json('/auth/status');
        const original_uid = status1.user_uid;
        assert.strictEqual(status1.authenticated, true);

        // Connect GitHub (so disconnecting Google leaves another method)
        nock('https://github.com').post('/login/oauth/access_token').reply(200, {
            access_token: 'fake-token', expires_in: 28800, refresh_token: 'ghr_xxx',
            refresh_token_expires_in: 15811200, token_type: 'bearer', scope: 'user:email',
        });
        nock('https://api.github.com').get('/user').reply(200, {id: 'github-sub-999', name: 'Test', avatar_url: null});
        nock('https://api.github.com').get('/user/emails').reply(200, []);
        await this.client.get_json_no_redirects('/auth/github?connect=1');
        const sess_gh = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/github/callback', {state: sess_gh.oauth_state, code: 'fake_code'}));

        // Disconnect Google
        await this.http_post_json('/auth/google/disconnect', {
            _csrf: await this.csrf_token(),
        });

        // Sign out
        await this.http_post_json('/auth/sign-out', {
            _csrf: await this.csrf_token(),
        });

        // Sign up again with the same Google account
        await sign_in_via_google(this.client, {sub: 'google-sub-123', email: 'google-user@authwall.test'});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
        // Must be a NEW user, not the original one
        assert.notStrictEqual(status2.user_uid, original_uid);
        // Email is already taken by original user, so new user should not have it
        assert.strictEqual(status2.providers.find(v => v.type === 'email'), undefined);
    });

});
