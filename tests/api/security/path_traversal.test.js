const assert = require('assert');
const config = require('../../../config');
const net = require('net');

// axios and the WHATWG URL parser resolve dot segments before a request is
// sent, so these tests speak raw HTTP: the proxy must be judged on the bytes
// a hostile client can put on the wire.
function raw_get(target, headers = {})
{
    const {hostname, port} = new URL(config.public_url);
    return new Promise(function (resolve, reject) {
        const socket = net.connect(Number(port), hostname);
        let data = '';
        socket.on('connect', function () {
            const lines = [`GET ${target} HTTP/1.1`, `Host: ${hostname}:${port}`, 'Connection: close'];
            for (const [k, v] of Object.entries(headers)) {
                lines.push(`${k}: ${v}`);
            }
            socket.write(lines.join('\r\n') + '\r\n\r\n');
        });
        socket.on('data', chunk => data += chunk);
        socket.on('error', reject);
        socket.on('close', function () {
            const [head, ...rest] = data.split('\r\n\r\n');
            const status = Number((head.match(/^HTTP\/1\.1 (\d+)/) || [])[1]);
            const location = (head.match(/\r\nLocation: ([^\r]+)/i) || [])[1] ?? null;
            let body = rest.join('\r\n\r\n');
            if (/transfer-encoding: chunked/i.test(head)) {
                body = body.split('\r\n').filter((_, i) => i % 2 === 1).join('');
            }
            let json = null;
            try { json = JSON.parse(body); } catch (error) {}
            resolve({status, location, body, json});
        });
    });
}

describe('path traversal past public_paths | security', function () {

    beforeEach(function () {
        config.public_paths = ['/favicon.ico', '/lib/*'];
        config.optional_auth_paths = ['/landing/*'];
    });

    it('serves a canonical public path anonymously', async function () {
        const r = await raw_get('/lib/app.js');
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.json.url, '/lib/app.js');
        assert.strictEqual('x-auth-user' in r.json.headers, false);
    });

    it('serves an encoded but canonical public path anonymously', async function () {
        const r = await raw_get('/lib/app%20name.js');
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.json.url, '/lib/app%20name.js');
    });

    const traversals = [
        '/lib/../admin',
        '/lib/x/../../admin',
        '/lib/%2e%2e/admin',
        '/lib/..%2fadmin',
        '/lib/%2e%2e%2fadmin',
        '/lib/;/../admin',
        '/lib/./admin',
        '/lib//admin',
        '/lib/%252fadmin',
        '/lib%5cadmin',
        '/lib/%zz',
        '/favicon.ico/../admin',
    ];

    for (const target of traversals) {
        it(`requires sign-in for ${target}`, async function () {
            const r = await raw_get(target);
            assert.strictEqual(r.status, 302, `expected a redirect, got ${r.status} ${r.body.slice(0, 80)}`);
            assert.match(r.location, /^\/auth\/sign-in\?return=/);
        });
    }

    it('does not treat a traversal into an optional-auth prefix as optional', async function () {
        const r = await raw_get('/landing/../admin');
        assert.strictEqual(r.status, 302);
    });

    it('proxies a non-canonical path for a signed-in user with X-Auth-User set', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const sess = await this.client.get_session();
        const cookie = Array.from(this.client.cookies.values()).join('; ');
        const r = await raw_get('/lib/../private', {Cookie: cookie});
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.json.url, '/lib/../private');
        assert.strictEqual(r.json.headers['x-auth-user'], sess.user_uid);
    });

});
