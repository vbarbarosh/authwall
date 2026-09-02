const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');

describe('security headers | security', function () {

    it('sets CSP and frame protection on Authwall pages and endpoints', async function () {
        const r = await axios.get('/auth/status', {baseURL: config.public_url, validateStatus: () => true});
        const csp = r.headers['content-security-policy'];
        assert.ok(csp, 'no CSP header');
        assert.match(csp, /frame-ancestors 'none'/);
        assert.match(csp, /default-src 'self'/);
        assert.match(csp, /form-action 'self'/);
        assert.strictEqual(r.headers['x-frame-options'], 'DENY');
        assert.strictEqual(r.headers['x-content-type-options'], 'nosniff');
        assert.strictEqual(r.headers['referrer-policy'], 'same-origin');
    });

    it('sets them on the served SPA pages', async function () {
        const r = await axios.get('/auth/sign-in', {baseURL: config.public_url, validateStatus: () => true});
        assert.ok(r.headers['content-security-policy']);
        assert.strictEqual(r.headers['x-frame-options'], 'DENY');
    });

    it('does not impose them on proxied upstream responses', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const r = await this.client.get_json('/some/upstream/path');
        assert.partialDeepStrictEqual(r, {echo_server: 'authwall_testing_echo_server'});
        assert.strictEqual(r.headers['content-security-policy'], undefined);
    });

});
