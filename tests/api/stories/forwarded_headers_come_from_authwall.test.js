const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');

const FORGED = {
    'X-Forwarded-For': '6.6.6.6',
    'X-Forwarded-Host': 'evil.test',
    'X-Forwarded-Proto': 'https',
    'X-Forwarded-Port': '6',
    'X-Forwarded-Prefix': '/evil',
    'X-Real-IP': '6.6.6.6',
    // PHP and Apache read these as the dashed ones (AW-83).
    'X_Forwarded_For': '7.7.7.7',
    'X_Forwarded_Host': 'evil7.test',
    'X_Forwarded_Proto': 'https',
    'X_Real_IP': '7.7.7.7',
    // Upstreams re-decide the client, the host or the path from these (AW-84).
    'Forwarded': 'for=8.8.8.8;proto=https;host=evil8.test',
    'X-Original-URL': '/admin/secret',
    'X-Rewrite-URL': '/admin/secret',
    'X-Original-Host': 'evil9.test',
    'X-Host': 'evil9.test',
    'X-Client-IP': '9.9.9.9',
    'True-Client-IP': '9.9.9.9',
    'CF-Connecting-IP': '9.9.9.9',
    'X-Cluster-Client-IP': '9.9.9.9',
    'X-ProxyUser-Ip': '9.9.9.9',
    // Left to the upstream: Authwall judges a path and a credential, not a method.
    'X-HTTP-Method-Override': 'DELETE',
};
const FORGED_NAMES = new Set(Object.keys(FORGED).map(v => v.toLowerCase()));

// See forwarded_headers_come_from_authwall.md.
describe('The upstream\'s forwarded headers come from Authwall | stories', function () {

    beforeEach(function () {
        config.trust_proxy = false;
        config.public_paths = ['/echo-me'];
        config.personal_access_tokens.enabled = true;
        config.websockets.enabled = true;
    });

    function forwarded(headers) {
        return Object.fromEntries(Object.entries(headers).filter(v => FORGED_NAMES.has(v[0]) || v[0].startsWith('x-forwarded-')));
    }

    function expected() {
        const {host, port} = new URL(config.public_url);
        return {'x-forwarded-for': '127.0.0.1', 'x-forwarded-host': host, 'x-forwarded-port': port, 'x-forwarded-proto': 'http', 'x-http-method-override': 'DELETE'};
    }

    async function ws_upstream_headers(_this) {
        await _this.sign_in({username: 'mocha', password: 'pass1234'});
        await _this.mark_confirmed({reason: 'pat_create'});
        const created = await _this.http_post_json('/auth/personal-access-tokens', {label: 'ws'});
        const r = await _this.ws_roundtrip('/realtime', {token: created.token, headers: FORGED});
        assert.strictEqual(r.opened, true, r.error);
        return r.upstream_headers;
    }

    describe('proxy mode', function () {

        beforeEach(function () {
            config.upstream.mode = 'proxy';
        });

        it('sets them over HTTP', async function () {
            const r = await axios.get('/echo-me', {baseURL: config.public_url, headers: FORGED});
            assert.deepStrictEqual(forwarded(r.data.headers), expected());
        });

        it('sets them over a WebSocket upgrade', async function () {
            assert.deepStrictEqual(forwarded(await ws_upstream_headers(this)), expected());
        });

    });

    describe('direct mode', function () {

        beforeEach(function () {
            config.upstream.mode = 'direct';
        });

        it('sends none over HTTP', async function () {
            const r = await axios.get('/echo-me', {baseURL: config.public_url, headers: FORGED});
            assert.deepStrictEqual(forwarded(r.data.headers), {'x-http-method-override': 'DELETE'});
        });

        it('sends none over a WebSocket upgrade', async function () {
            assert.deepStrictEqual(forwarded(await ws_upstream_headers(this)), {'x-http-method-override': 'DELETE'});
        });

    });

});
