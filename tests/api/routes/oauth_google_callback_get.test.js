const assert = require('assert');
const config = require('../../../config');
const mock_google = require('../../mock_google');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function start_oauth_flow(client)
{
    await client.get_json_no_redirects('/auth/google');
    return (await client.get_session()).oauth_state;
}

describe('GET /auth/google/callback', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    it('signs in existing google user', async function () {

        // First sign up
        mock_google();
        await this.http_get_json(urlmod('/auth/google/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));
        const status1 = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status1, {
            error: null,
            authenticated: true,
        });

        // Sign out, then sign in again with same Google account
        await this.http_post_json('/auth/sign-out');

        mock_google();
        await this.http_get_json(urlmod('/auth/google/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));

        const status2 = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status2, {
            error: null,
            authenticated: true,
        });

        // Same user
        assert.strictEqual(status2.user_uid, status1.user_uid);
    });

    it('signs up new google user', async function () {

        mock_google();
        await this.http_get_json(urlmod('/auth/google/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
            display_name: 'Test User',
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_google' && v.value === 'google-user-123'));
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'test@example.com'));
    });

    it('connects google account to existing session', async function () {

        await this.sign_in({username: 'mocha', password: 'pass123'});

        mock_google();
        await this.client.get_json_no_redirects('/auth/google?connect=1');
        const state = (await this.client.get_session()).oauth_state;
        await this.http_get_json(urlmod('/auth/google/callback', {state, code: 'fake_code'}));

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_google' && v.value_normalized === 'google-user-123'));
    });

    it('fails with missing oauth code', async function () {
        await this.http_get_json(urlmod('/auth/google/callback', {state: await start_oauth_flow(this.client)}));
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Missing OAuth code',
            authenticated: false,
        });
    });

    it('fails with invalid oauth state', async function () {
        await this.client.get_json_no_redirects('/auth/google'); // sets oauth_state in session
        await this.http_get_json(urlmod('/auth/google/callback', {code: 'fake_code', state: 'tampered-state'}));
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid OAuth state',
            authenticated: false,
        });
    });

});
