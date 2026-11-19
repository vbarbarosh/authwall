const assert = require('assert');
const config = require('../../../config');
const http = require('http');

// What a client may send to be believed by the app behind Authwall.
const CLIENT = {
    'x-forwarded-for': '6.6.6.6',
    'x-forwarded-host': 'evil.test',
    'x-real-ip': '6.6.6.6',
    'forwarded': 'for=6.6.6.6',
    'x-original-url': '/admin',
    'x-auth-user': 'admin',
    'x-role': 'admin',
    'remote-user': 'admin',
};

// One raw request, so the Expect header goes out as written.
function http_send_raw(method, path, headers, body)
{
    return new Promise(function (resolve, reject) {
        const url = new URL(config.public_url);
        const req = http.request({host: url.hostname, port: url.port, method, path, headers}, function (res) {
            const chunks = [];
            res.on('data', v => chunks.push(v));
            res.on('end', () => resolve({status: res.statusCode, body: Buffer.concat(chunks).toString()}));
        });
        req.on('error', reject);
        req.end(body);
    });
}

async function upstream_headers_of(method, path, headers)
{
    const body = (method === 'POST') ? 'hi' : '';
    const r = await http_send_raw(method, path, {...CLIENT, ...headers, 'content-length': String(body.length)}, body);
    assert.strictEqual(r.status, 200, r.body);
    return JSON.parse(r.body).headers;
}

// See expect_keeps_every_header_rule.md.
describe('A request with Expect gets every header rule | stories', function () {

    beforeEach(function () {
        config.trust_proxy = false;
        config.public_paths = ['/echo-me'];
        config.upstream.mode = 'proxy';
        config.upstream.set_headers = [{name: 'X-Role', value: 'viewer'}, {name: 'X-Proxy-Secret', value: 'operator-secret'}];
        config.upstream.unset_headers = ['Remote-User'];
        config.personal_access_tokens.enabled = true;
        config.websockets.enabled = true;
    });

    it('a signed-in POST with Expect reaches the app as one without', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const {user_uid} = await this.client.get_session();
        const cookie = [...this.client.cookies.values()].join('; ');

        const plain = await upstream_headers_of('POST', '/private/page', {cookie});
        assert.strictEqual(plain['x-auth-user'], user_uid);
        assert.strictEqual(plain['x-role'], 'viewer');
        assert.strictEqual(plain['x-proxy-secret'], 'operator-secret');
        assert.strictEqual(plain['x-forwarded-for'], '127.0.0.1');
        for (const name of ['cookie', 'remote-user', 'x-real-ip', 'forwarded', 'x-original-url']) {
            assert.strictEqual(name in plain, false, name);
        }

        const expect = await upstream_headers_of('POST', '/private/page', {cookie, expect: '100-continue'});
        assert.deepStrictEqual(expect, plain);
    });

    it('an anonymous GET with Expect on a public path reaches the app as one without', async function () {
        const plain = await upstream_headers_of('GET', '/echo-me', {});
        assert.strictEqual('x-auth-user' in plain, false);
        assert.strictEqual(plain['x-role'], 'viewer');

        const expect = await upstream_headers_of('GET', '/echo-me', {expect: '100-continue'});
        assert.deepStrictEqual(expect, plain);
    });

    it('a WebSocket upgrade with Expect reaches the app as one without', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const {user_uid} = await this.client.get_session();
        await this.mark_confirmed({reason: 'pat_create'});
        const {token} = await this.http_post_json('/auth/personal-access-tokens', {label: 'ws'});

        const plain = await this.ws_roundtrip('/realtime', {token, headers: CLIENT});
        const expect = await this.ws_roundtrip('/realtime', {token, headers: {...CLIENT, expect: '100-continue'}});
        assert.strictEqual(plain.opened, true, plain.error);
        assert.strictEqual(expect.opened, true, expect.error);
        assert.strictEqual(plain.upstream_headers['x-auth-user'], user_uid);
        assert.strictEqual(plain.upstream_headers['x-role'], 'viewer');
        for (const v of [plain, expect]) {
            delete v.upstream_headers['sec-websocket-key'];
        }
        assert.deepStrictEqual(expect.upstream_headers, plain.upstream_headers);
    });
});
