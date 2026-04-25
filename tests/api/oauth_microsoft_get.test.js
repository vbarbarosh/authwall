const assert = require('assert');
const config = require('../../config');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('GET /auth/microsoft', function () {

    beforeEach(function () {
        config.flows.microsoft.enabled = true;
        config.flows.microsoft.client_id = 'mocha_microsoft_client_id';
        config.flows.microsoft.redirect_url = 'mocha_microsoft_redirect_url';
    });

    afterEach(function () {
        config.flows.microsoft.enabled = false;
    });

    it('redirects to microsoft oauth with login intent', async function () {
        const r = await this.client.get_json_no_redirects('/auth/microsoft');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, urlmod('https://login.microsoftonline.com/common/oauth2/v2.0/authorize', {
            client_id: 'mocha_microsoft_client_id',
            redirect_uri: 'mocha_microsoft_redirect_url',
            response_type: 'code',
            scope: 'openid email profile',
            prompt: 'select_account',
            state: sess.oauth_state,
            code_challenge: crypto_hash_sha256(sess.oauth_code_verifier).toString('base64url'),
            code_challenge_method: 'S256',
        }));
    });

    it('redirects to microsoft oauth with connect intent', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const r = await this.client.get_json_no_redirects('/auth/microsoft?connect=1');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        const location = new URL(r.headers.location);
        assert.strictEqual(location.origin + location.pathname, 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
        assert.strictEqual(location.searchParams.get('state'), sess.oauth_state);
        assert.notStrictEqual(sess.oauth_state, null);
    });

});
