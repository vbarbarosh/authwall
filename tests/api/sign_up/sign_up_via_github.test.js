const assert = require('assert');
const config = require('../../../config');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const mock_github = require('../../mock_github');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('sign up via github | scenarios', function () {

    beforeEach(function () {
        config.flows.github.enabled = true;
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
        mock_github();
    });

    it('signup via github should mark the email as verified', async function () {
        const r = await this.client.get_json_no_redirects('/auth/github');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, urlmod('https://github.com/login/oauth/authorize', {
            client_id: config.flows.github.client_id,
            redirect_uri: config.flows.github.redirect_url,
            scope: 'user:email',
            prompt: 'select_account',
            state: sess.oauth_state,
            code_challenge: crypto_hash_sha256(sess.oauth_code_verifier).toString('base64url'),
            code_challenge_method: 'S256',
        }));

        await this.http_get_json(urlmod('/auth/github/callback', {
            code: '4/fake_code',
            state: sess.oauth_state,
        }));

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
            display_name: 'Test User',
            avatar_url: 'https://example.com/avatar.jpg',
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_github' && v.value === 'github-user-123').verified_at !== null);
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'jack@domain1.com').verified_at !== null);
    });

});
