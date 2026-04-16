const assert = require('assert');
const config = require('../../config');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

function mock_google(userinfo)
{
    nock.cleanAll();

    nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, {access_token: 'fake-token'});

    nock('https://www.googleapis.com')
        .get('/oauth2/v3/userinfo')
        .reply(200, {
            sub: 'google-sub-123',
            name: 'Test User',
            picture: 'https://example.com/avatar.jpg',
            email: 'test@example.com',
            email_verified: true,
            ...userinfo,
        });
}

async function start_oauth_flow(client)
{
    await client.get_json('/auth/google');
    return (await client.get_session()).oauth_state;
}

describe('GET /auth/google/callback', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    afterEach(function () {
        config.flows.google.enabled = false;
    });

    it('signs in existing google user', async function () {
        // First sign up
        mock_google();
        const state = await start_oauth_flow(this.client);
        await this.http_get_json(urlmod('/auth/google/callback', {state, code: 'fake_code'}));
        const status1 = await this.http_get_json('/auth/status');
        assert.strictEqual(status1.authenticated, true);
        const session1 = await this.client.get_session();

        // Sign out, then sign in again with same Google account
        await this.client.post_json('/auth/sign-out', {_csrf: status1.csrf_token});
        mock_google();
        const state2 = await start_oauth_flow(this.client);
        await this.http_get_json(urlmod('/auth/google/callback', {state: state2, code: 'fake_code'}));

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
        // Same user
        assert.strictEqual(status2.user_uid, status1.user_uid);
    });

    it('signs up new google user', async function () {
        mock_google();
        const state = await start_oauth_flow(this.client);
        await this.http_get_json(urlmod('/auth/google/callback', {state, code: 'fake_code'}));

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, null);
        assert.strictEqual(status.authenticated, true);
        assert.strictEqual(status.display_name, 'Test User');
        assert.ok(status.providers.find(v => v.type === 'oauth_google' && v.value === 'google-sub-123'));
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'test@example.com'));
    });

    it('connects google account to existing session', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        mock_google();
        await this.http_get_json('/auth/google?connect=1');
        const state = (await this.client.get_session()).oauth_state;
        await this.http_get_json(urlmod('/auth/google/callback', {state, code: 'fake_code'}));

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, null);
        assert.strictEqual(status.authenticated, true);
        assert.ok(status.providers.find(v => v.type === 'oauth_google' && v.value_normalized === 'google-sub-123'));
    });

    it('fails with missing oauth code', async function () {
        const state = await start_oauth_flow(this.client);
        await this.http_get_json(urlmod('/auth/google/callback', {state}));
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Missing OAuth code');
    });

    it('fails with invalid oauth state', async function () {
        await this.http_get_json('/auth/google'); // sets oauth_state in session
        await this.http_get_json(urlmod('/auth/google/callback', {state: 'tampered-state', code: 'fake_code'}));
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Invalid OAuth state');
    });

});
