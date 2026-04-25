const assert = require('assert');
const config = require('../../../config');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const mock_facebook = require('../../mock_facebook');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('sign up via facebook | scenarios', function () {

    beforeEach(function () {
        config.flows.facebook.enabled = true;
        config.flows.facebook.client_id = 'mocha_facebook_client_id';
        config.flows.facebook.client_secret = 'mocha_facebook_client_secret';
        config.flows.facebook.redirect_url = 'mocha_facebook_redirect_url';
        config.access.allowed_emails = [];
        config.access.allowed_domains = [];
        config.access.denied_emails = [];
        config.access.denied_domains = [];
        mock_facebook();
    });

    afterEach(function () {
        config.flows.facebook.enabled = false;
    });

    it('signup via facebook should mark the email as verified', async function () {
        const r = await this.client.get_json_no_redirects('/auth/facebook');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, urlmod('https://www.facebook.com/v22.0/dialog/oauth', {
            client_id: 'mocha_facebook_client_id',
            redirect_uri: 'mocha_facebook_redirect_url',
            response_type: 'code',
            scope: 'email',
            state: sess.oauth_state,
            code_challenge: crypto_hash_sha256(sess.oauth_code_verifier).toString('base64url'),
            code_challenge_method: 'S256',
        }));

        await this.http_get_json(urlmod('/auth/facebook/callback', {
            state: sess.oauth_state,
            code: 'fake_code',
        }));
        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
            display_name: 'Test User',
            avatar_url: 'https://example.com/facebook-avatar.jpg',
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_facebook' && v.value === 'facebook-user-123').verified_at !== null);
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'test@example.com').verified_at !== null);
    });

});
