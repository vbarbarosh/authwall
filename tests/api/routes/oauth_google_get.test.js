const assert = require('assert');
const config = require('../../../config');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('GET /auth/google', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    it('redirects to google oauth with login intent', async function () {
        const r = await this.client.get_json_no_redirects('/auth/google');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, urlmod('https://accounts.google.com/o/oauth2/v2/auth', {
            client_id: 'mocha_google_client_id',
            redirect_uri: 'mocha_google_redirect_url',
            response_type: 'code',
            scope: 'openid email profile',
            access_type: 'offline',
            prompt: 'select_account',
            state: sess.oauth_state,
            code_challenge: crypto_hash_sha256(sess.oauth_code_verifier).toString('base64url'),
            code_challenge_method: 'S256',
        }));
    });

    it('redirects to google oauth with connect intent', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const r = await this.client.get_json_no_redirects('/auth/google?connect=1');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        const location = new URL(r.headers.location);
        assert.strictEqual(location.origin + location.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
        assert.strictEqual(location.searchParams.get('state'), sess.oauth_state);
        // connect intent embeds a different state value than login intent
        assert.notStrictEqual(sess.oauth_state, null);
    });

});
