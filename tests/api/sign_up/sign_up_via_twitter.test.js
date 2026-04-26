const assert = require('assert');
const config = require('../../../config');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const mock_twitter = require('../../mock_twitter');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('sign up via X | scenarios', function () {

    beforeEach(function () {
        config.flows.twitter.enabled = true;
        config.flows.twitter.client_id = 'mocha_twitter_client_id';
        config.flows.twitter.client_secret = 'mocha_twitter_client_secret';
        config.flows.twitter.redirect_url = 'mocha_twitter_redirect_url';
        config.access.allowed_emails = [];
        config.access.allowed_domains = [];
        config.access.denied_emails = [];
        config.access.denied_domains = [];
        mock_twitter();
    });

    it('signup via X should mark the email as verified', async function () {
        const r = await this.client.get_json_no_redirects('/auth/twitter');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, urlmod('https://x.com/i/oauth2/authorize', {
            response_type: 'code',
            client_id: 'mocha_twitter_client_id',
            redirect_uri: 'mocha_twitter_redirect_url',
            scope: 'tweet.read users.read users.email',
            state: sess.oauth_state,
            code_challenge: crypto_hash_sha256(sess.oauth_code_verifier).toString('base64url'),
            code_challenge_method: 'S256',
        }));

        await this.http_get_json(urlmod('/auth/twitter/callback', {
            state: sess.oauth_state,
            code: 'fake_code',
        }));
        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
            display_name: 'Test User',
            avatar_url: 'https://example.com/twitter-avatar.jpg',
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_twitter' && v.value === '123456789').verified_at !== null);
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'test@example.com').verified_at !== null);
    });

});
