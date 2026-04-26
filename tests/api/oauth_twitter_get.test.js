const assert = require('assert');
const config = require('../../config');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('GET /auth/twitter', function () {

    beforeEach(function () {
        config.flows.twitter.enabled = true;
        config.flows.twitter.client_id = 'mocha_twitter_client_id';
        config.flows.twitter.redirect_url = 'mocha_twitter_redirect_url';
    });

    it('redirects to X oauth with login intent', async function () {
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
    });

    it('redirects to X oauth with connect intent', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const r = await this.client.get_json_no_redirects('/auth/twitter?connect=1');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        const location = new URL(r.headers.location);
        assert.strictEqual(location.origin + location.pathname, 'https://x.com/i/oauth2/authorize');
        assert.strictEqual(location.searchParams.get('state'), sess.oauth_state);
        assert.notStrictEqual(sess.oauth_state, null);
    });

});
