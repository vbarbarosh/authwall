const assert = require('assert');
const config = require('../../config');
const mock_discord = require('../mock_discord');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function start_oauth_flow(client)
{
    await client.get_json_no_redirects('/auth/discord');
    return (await client.get_session()).oauth_state;
}

describe('GET /auth/discord/callback', function () {

    beforeEach(function () {
        config.flows.discord.enabled = true;
        config.flows.discord.client_id = 'mocha_discord_client_id';
        config.flows.discord.client_secret = 'mocha_discord_client_secret';
        config.flows.discord.redirect_url = 'mocha_discord_redirect_url';
        config.access.allowed_emails = [];
        config.access.allowed_domains = [];
        config.access.denied_emails = [];
        config.access.denied_domains = [];
    });

    afterEach(function () {
        config.flows.discord.enabled = false;
    });

    it('signs in existing discord user', async function () {
        mock_discord();
        await this.http_get_json(urlmod('/auth/discord/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));
        const status1 = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status1, {
            error: null,
            authenticated: true,
        });

        await this.http_post_json('/auth/sign-out');

        mock_discord();
        await this.http_get_json(urlmod('/auth/discord/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));

        const status2 = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status2, {
            error: null,
            authenticated: true,
        });
        assert.strictEqual(status2.user_uid, status1.user_uid);
    });

    it('signs up new discord user', async function () {
        mock_discord();
        await this.http_get_json(urlmod('/auth/discord/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
            display_name: 'Test User',
            avatar_url: 'https://cdn.discordapp.com/avatars/123456789123456789/discord-avatar-hash.png',
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_discord' && v.value === '123456789123456789'));
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'test@example.com'));
    });

    it('connects discord account to existing session', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});

        mock_discord();
        await this.client.get_json_no_redirects('/auth/discord?connect=1');
        const state = (await this.client.get_session()).oauth_state;
        await this.http_get_json(urlmod('/auth/discord/callback', {state, code: 'fake_code'}));

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_discord' && v.value_normalized === '123456789123456789'));
    });

    it('does not add unverified discord emails', async function () {
        mock_discord({verified: false});
        await this.http_get_json(urlmod('/auth/discord/callback', {code: 'fake_code', state: await start_oauth_flow(this.client)}));

        const status = await this.http_get_json('/auth/status');
        assert.ok(status.providers.find(v => v.type === 'oauth_discord'));
        assert.strictEqual(status.providers.find(v => v.type === 'email'), undefined);
    });

    it('fails with missing oauth code', async function () {
        await this.http_get_json(urlmod('/auth/discord/callback', {state: await start_oauth_flow(this.client)}));
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Missing OAuth code',
            authenticated: false,
        });
    });

    it('fails with invalid oauth state', async function () {
        await this.client.get_json_no_redirects('/auth/discord');
        await this.http_get_json(urlmod('/auth/discord/callback', {code: 'fake_code', state: 'tampered-state'}));
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid OAuth state',
            authenticated: false,
        });
    });

});
