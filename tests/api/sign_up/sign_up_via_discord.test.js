const assert = require('assert');
const config = require('../../../config');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const mock_discord = require('../../mock_discord');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('sign up via discord | scenarios', function () {

    beforeEach(function () {
        config.flows.discord.enabled = true;
        config.flows.discord.client_id = 'mocha_discord_client_id';
        config.flows.discord.client_secret = 'mocha_discord_client_secret';
        config.flows.discord.redirect_url = 'mocha_discord_redirect_url';
        mock_discord();
    });

    afterEach(function () {
        config.flows.discord.enabled = false;
    });

    it('signup via discord should mark the email as verified', async function () {
        const r = await this.client.get_json_no_redirects('/auth/discord');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, urlmod('https://discord.com/oauth2/authorize', {
            client_id: config.flows.discord.client_id,
            redirect_uri: config.flows.discord.redirect_url,
            response_type: 'code',
            scope: 'identify email',
            prompt: 'consent',
            state: sess.oauth_state,
            code_challenge: crypto_hash_sha256(sess.oauth_code_verifier).toString('base64url'),
            code_challenge_method: 'S256',
        }));

        await this.http_get_json(urlmod('/auth/discord/callback', {
            code: 'fake_code',
            state: sess.oauth_state,
        }));

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
            display_name: 'Test User',
            avatar_url: 'https://cdn.discordapp.com/avatars/123456789123456789/discord-avatar-hash.png',
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_discord' && v.value === '123456789123456789').verified_at !== null);
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'test@example.com').verified_at !== null);
    });

});
