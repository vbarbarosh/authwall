const assert = require('assert');
const config = require('../../../config');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// Shared helpers

function mock_github({id = 'github-sub-123', email = null} = {})
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
        .reply(200, {
            id,
            name: 'GitHub User',
            avatar_url: null,
        });

    nock('https://api.github.com')
        .get('/user/emails')
        .reply(200, email ? [{email, primary: true, verified: true, visibility: 'public'}] : []);
}

function mock_google({sub = 'google-sub-123', email = null} = {})
{
    nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, {access_token: 'fake-token'});

    nock('https://www.googleapis.com')
        .get('/oauth2/v3/userinfo')
        .reply(200, {
            sub,
            name: 'Google User',
            picture: null,
            email,
            email_verified: email !== null,
        });
}

async function sign_in_via_github(client, opts)
{
    mock_github(opts);
    await client.get_json_no_redirects('/auth/github');
    const sess = await client.get_session();
    await client.get_json(urlmod('/auth/github/callback', {state: sess.oauth_state, code: 'fake_code'}));
}

async function connect_google(client, opts)
{
    mock_google(opts);
    await client.get_json_no_redirects('/auth/google?connect=1');
    const sess = await client.get_session();
    await client.get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
}

describe('GitHub user without email — password setup impossible | stories', function () {

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

    it('cannot set a password when signed up via GitHub with no email', async function () {
        await sign_in_via_github(this.client, {email: null});

        const status = await this.client.get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);
        // No email and no username — only oauth_github
        assert.strictEqual(status.providers.length, 1);
        assert.strictEqual(status.providers[0].type, 'oauth_github');

        await this.client.post_json('/auth/change-password', {
            current_password: 'anything',
            password: 'newpass',
            password_confirm: 'newpass',
            _csrf: status.csrf_token,
        });

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Cannot set or change password without a verified email or username');
    });

    it('can set a password after connecting Google with a verified email', async function () {
        await sign_in_via_github(this.client, {email: null});

        // Connect Google — brings in a verified email identity
        await connect_google(this.client, {email: 'user@example.com'});

        const status = await this.client.get_json('/auth/status');
        assert.ok(status.providers.find(v => v.type === 'oauth_github'));
        assert.ok(status.providers.find(v => v.type === 'email' && v.verified_at !== null));

        // Now password setup should succeed
        await this.client.post_json('/auth/change-password', {
            current_password: '',
            password: 'newpass',
            password_confirm: 'newpass',
            _csrf: status.csrf_token,
        });

        const status2 = await this.client.get_json('/auth/status');
        // Error here is about wrong current_password, not about missing identity
        assert.notStrictEqual(status2.error, 'Cannot set or change password without a verified email or username');
    });

});
