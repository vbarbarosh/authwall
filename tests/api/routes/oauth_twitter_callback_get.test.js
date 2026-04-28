const assert = require('assert');
const config = require('../../../config');
const mock_twitter = require('../../mock_twitter');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function start_oauth_flow(client)
{
    await client.get_json_no_redirects('/auth/twitter');
    return (await client.get_session()).oauth_state;
}

describe('GET /auth/twitter/callback', function () {

    beforeEach(function () {
        config.flows.twitter.enabled = true;
        config.flows.twitter.client_id = 'mocha_twitter_client_id';
        config.flows.twitter.client_secret = 'mocha_twitter_client_secret';
        config.flows.twitter.redirect_url = 'mocha_twitter_redirect_url';
        config.access.allowed_emails = [];
        config.access.allowed_domains = [];
        config.access.denied_emails = [];
        config.access.denied_domains = [];
    });

    it('signs in existing X user', async function () {
        mock_twitter();
        await this.http_get_json(urlmod('/auth/twitter/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));
        const status1 = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status1, {
            error: null,
            authenticated: true,
        });

        await this.http_post_json('/auth/sign-out');

        mock_twitter();
        await this.http_get_json(urlmod('/auth/twitter/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));

        const status2 = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status2, {
            error: null,
            authenticated: true,
        });
        assert.strictEqual(status2.user_uid, status1.user_uid);
    });

    it('signs up new X user', async function () {
        mock_twitter();
        await this.http_get_json(urlmod('/auth/twitter/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
            display_name: 'Test User',
            avatar_url: 'https://example.com/twitter-avatar.jpg',
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_twitter' && v.value === '123456789'));
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'test@example.com'));
    });

    it('connects X account to existing session', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});

        mock_twitter();
        await this.client.get_json_no_redirects('/auth/twitter?connect=1');
        const state = (await this.client.get_session()).oauth_state;
        await this.http_get_json(urlmod('/auth/twitter/callback', {state, code: 'fake_code'}));

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_twitter' && v.value_normalized === '123456789'));
    });

    it('fails with missing oauth code', async function () {
        await this.http_get_json(urlmod('/auth/twitter/callback', {state: await start_oauth_flow(this.client)}));
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Missing OAuth code',
            authenticated: false,
        });
    });

    it('fails with invalid oauth state', async function () {
        await this.client.get_json_no_redirects('/auth/twitter');
        await this.http_get_json(urlmod('/auth/twitter/callback', {code: 'fake_code', state: 'tampered-state'}));
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid OAuth state',
            authenticated: false,
        });
    });

});
