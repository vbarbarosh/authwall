const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');

// See sidecar_path_headers_must_agree.md.
describe('The sidecar\'s two path headers must agree | stories', function () {

    beforeEach(function () {
        config.public_paths = ['/favicon.ico'];
    });

    function sidecar(headers) {
        return axios.get('/auth/sidecar', {baseURL: config.public_url, headers, maxRedirects: 0, validateStatus: () => true});
    }

    it('refuses behind Caddy when the client adds X-Original-URI', async function () {
        const r = await sidecar({'X-Forwarded-Uri': '/private/admin', 'X-Original-URI': '/favicon.ico'});
        assert.strictEqual(r.status, 401);
        assert.strictEqual(r.headers['x-auth-user'], undefined);
    });

    it('refuses behind nginx when the client adds X-Forwarded-Uri', async function () {
        const r = await sidecar({'X-Original-URI': 'http://app.test/private/admin', 'X-Forwarded-Uri': '/favicon.ico'});
        assert.strictEqual(r.status, 401);
        assert.strictEqual(r.headers['x-auth-user'], undefined);
    });

    it('admits a public path from either header, or from both when they agree', async function () {
        for (const headers of [
            {'X-Forwarded-Uri': '/favicon.ico'},
            {'X-Original-URI': 'http://app.test/favicon.ico'},
            {'X-Original-URI': 'http://app.test/favicon.ico', 'X-Forwarded-Uri': '/favicon.ico'},
        ]) {
            const r = await sidecar(headers);
            assert.strictEqual(r.status, 200, JSON.stringify(headers));
            assert.strictEqual(r.headers['x-auth-user'], undefined);
        }
    });

});
