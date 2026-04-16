const assert = require('assert');
const config = require('../../../config');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

function mock_github({id = 'github-sub-123', email = 'shared@example.com'} = {})
{
    nock('https://github.com')
        .post('/login/oauth/access_token')
        .reply(200, {
            access_token: 'fake-token',
            expires_in: 28800,
            refresh_token: 'ghr_xxx',
            refresh_token_expires_in: 15811200,
            token_type: 'bearer',
            scope: 'user:email',
        });

    nock('https://api.github.com')
        .get('/user')
        .reply(200, {id, name: 'GitHub User', avatar_url: null});

    nock('https://api.github.com')
        .get('/user/emails')
        .reply(200, email ? [{email, primary: true, verified: true, visibility: 'public'}] : []);
}

function mock_google({sub = 'google-sub-123', email = 'shared@example.com'} = {})
{
    nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, {access_token: 'fake-token'});

    nock('https://www.googleapis.com')
        .get('/oauth2/v3/userinfo')
        .reply(200, {sub, name: 'Google User', picture: null, email, email_verified: true});
}

// User signed up using Google with verified email, then connected GitHub with the same email.
// Both providers should be attached to the same user account.
describe('Google + GitHub with same email attach to same user | stories', function () {

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

    it('connects GitHub to the Google account when both share the same email', async function () {
        // Sign up via Google (creates user with oauth_google + email)
        mock_google({email: 'shared@example.com'});
        await this.client.get_json_no_redirects('/auth/google');
        const sess1 = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/google/callback', {state: sess1.oauth_state, code: 'fake_code'}));

        const status1 = await this.http_get_json('/auth/status');
        assert.strictEqual(status1.authenticated, true);
        assert.ok(status1.providers.find(v => v.type === 'oauth_google'));
        assert.ok(status1.providers.find(v => v.type === 'email' && v.value === 'shared@example.com'));

        // Connect GitHub (which also has the same email)
        mock_github({email: 'shared@example.com'});
        await this.client.get_json_no_redirects('/auth/github?connect=1');
        const sess2 = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/github/callback', {state: sess2.oauth_state, code: 'fake_code'}));

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
        assert.ok(status2.providers.find(v => v.type === 'oauth_google'));
        assert.ok(status2.providers.find(v => v.type === 'oauth_github'));
        assert.ok(status2.providers.find(v => v.type === 'email' && v.value === 'shared@example.com'));
        // All providers belong to the same user
        assert.strictEqual(status2.user_uid, status1.user_uid);
    });

});
