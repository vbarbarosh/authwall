const assert = require('assert');
const config = require('../../../config');
const net = require('net');

// Clients such as axios and ws never put a fragment or an absolute URL on the
// wire, so these tests write the request line by hand.
function raw_request(lines)
{
    const {hostname, port} = new URL(config.public_url);
    return new Promise(function (resolve, reject) {
        const socket = net.connect(Number(port), hostname);
        let data = '';
        socket.on('connect', () => socket.write([...lines, `Host: ${hostname}:${port}`].join('\r\n') + '\r\n\r\n'));
        socket.on('data', v => data += v);
        socket.on('error', reject);
        socket.on('close', () => resolve({status: Number((data.match(/^HTTP\/1\.1 (\d+)/) || [])[1]), data}));
    });
}

describe('request target outside origin form | security', function () {

    beforeEach(function () {
        config.public_paths = ['/favicon.ico', '/lib/*'];
        config.optional_auth_paths = ['/landing/*'];
    });

    it('still serves a canonical public path anonymously', async function () {
        const r = await raw_request(['GET /favicon.ico HTTP/1.1', 'Connection: close']);
        assert.strictEqual(r.status, 200);
    });

    const targets = [
        '/favicon.ico#/../admin.txt',
        '/lib/x#/../../admin',
        '/landing/x#/../../admin',
        '/admin#',
        'http://evil.test/favicon.ico',
        '*',
    ];

    for (const target of targets) {
        it(`answers 400 to ${target} without reaching the upstream`, async function () {
            const r = await raw_request([`GET ${target} HTTP/1.1`, 'Connection: close']);
            assert.strictEqual(r.status, 400, r.data.slice(0, 200));
            assert.strictEqual(r.data.includes('"url"'), false, 'the echo upstream answered');
            assert(this.written_logs.some(v => v.includes('[bad_request_target]')));
        });
    }

    it('answers 400 to a websocket upgrade with a fragment, before authentication', async function () {
        config.websockets.enabled = true;
        const r = await raw_request([
            'GET /realtime#/../admin HTTP/1.1',
            'Upgrade: websocket',
            'Connection: Upgrade',
            'Sec-WebSocket-Version: 13',
            'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
        ]);
        assert.strictEqual(r.status, 400);
    });

});
