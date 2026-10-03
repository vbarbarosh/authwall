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
};

// See forwarded_headers_come_from_authwall.md.
describe('The upstream\'s forwarded headers come from Authwall | stories', function () {

    beforeEach(function () {
        config.trust_proxy = false;
        config.public_paths = ['/echo-me'];
        config.personal_access_tokens.enabled = true;
        config.websockets.enabled = true;
    });

    function forwarded(headers) {
        return Object.fromEntries(Object.entries(headers).filter(v => v[0].startsWith('x-forwarded-') || v[0] === 'x-real-ip'));
    }

    function expected() {
        const {host, port} = new URL(config.public_url);
        return {'x-forwarded-for': '127.0.0.1', 'x-forwarded-host': host, 'x-forwarded-port': port, 'x-forwarded-proto': 'http'};
    }

    async function ws_upstream_headers(_this) {
        await _this.sign_in({username: 'mocha', password: 'pass1234'});
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
            assert.deepStrictEqual(forwarded(r.data.headers), {});
        });

        it('sends none over a WebSocket upgrade', async function () {
            assert.deepStrictEqual(forwarded(await ws_upstream_headers(this)), {});
        });

    });

});
