const assert = require('assert');
const config = require('../../../config');
const mock_microsoft = require('../../mock_microsoft');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function start_oauth_flow(client)
{
    await client.get_json_no_redirects('/auth/microsoft');
    return (await client.get_session()).oauth_state;
}

describe('GET /auth/microsoft/callback', function () {

    beforeEach(function () {
        config.flows.microsoft.enabled = true;
        config.flows.microsoft.client_id = 'mocha_microsoft_client_id';
        config.flows.microsoft.client_secret = 'mocha_microsoft_client_secret';
        config.flows.microsoft.redirect_url = 'mocha_microsoft_redirect_url';
        config.access.allowed_emails = [];
        config.access.allowed_domains = [];
        config.access.denied_emails = [];
        config.access.denied_domains = [];
    });

    it('signs in existing microsoft user', async function () {

        // First sign up
        mock_microsoft();
        await this.http_get_json(urlmod('/auth/microsoft/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));
        const status1 = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status1, {
            error: null,
            authenticated: true,
        });

        // Sign out, then sign in again with same Microsoft account
        await this.http_post_json('/auth/sign-out');

        mock_microsoft();
        await this.http_get_json(urlmod('/auth/microsoft/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));

        const status2 = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status2, {
            error: null,
            authenticated: true,
        });

        // Same user
        assert.strictEqual(status2.user_uid, status1.user_uid);
    });

    it('signs up new microsoft user', async function () {

        mock_microsoft();
        await this.http_get_json(urlmod('/auth/microsoft/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
            display_name: 'Test User',
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_microsoft' && v.value === 'microsoft-user-123'));
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'test@example.com'));
    });

    it('connects microsoft account to existing session', async function () {

        await this.sign_in({username: 'mocha', password: 'pass123'});

        mock_microsoft();
        await this.client.get_json_no_redirects('/auth/microsoft?connect=1');
        const state = (await this.client.get_session()).oauth_state;
        await this.http_get_json(urlmod('/auth/microsoft/callback', {state, code: 'fake_code'}));

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_microsoft' && v.value_normalized === 'microsoft-user-123'));
    });

    // A tenant that returns no name claims at all. The given/family fallback
    // used to be built by string interpolation, so a missing claim was stored
    // as the literal display name "undefined undefined".
    it('leaves display_name null when the provider sends no name claims', async function () {

        nock.cleanAll();
        nock('https://login.microsoftonline.com')
            .post('/common/oauth2/v2.0/token')
            .reply(200, {access_token: 'fake-token', token_type: 'Bearer'});
        nock('https://login.microsoftonline.com')
            .get('/common/v2.0/.well-known/openid-configuration')
            .reply(200, {userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo'});
        nock('https://graph.microsoft.com')
            .get('/oidc/userinfo')
            .reply(200, {sub: 'microsoft-user-456', email: 'noname@example.com'});

        await this.http_get_json(urlmod('/auth/microsoft/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);
        assert.strictEqual(status.display_name, null);
    });

    it('fails with missing oauth code', async function () {
        await this.http_get_json(urlmod('/auth/microsoft/callback', {state: await start_oauth_flow(this.client)}));
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Missing OAuth code',
            authenticated: false,
        });
    });

    it('fails with invalid oauth state', async function () {
        await this.client.get_json_no_redirects('/auth/microsoft');
        await this.http_get_json(urlmod('/auth/microsoft/callback', {code: 'fake_code', state: 'tampered-state'}));
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid OAuth state',
            authenticated: false,
        });
    });

});
