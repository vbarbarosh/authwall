const assert = require('assert');
const config = require('../../../config');
const http = require('http');
const net = require('net');

// See half_sent_requests_hold_no_one_up.md.
describe('Half-sent requests hold no one up | stories', function () {

    beforeEach(function () {
        config.public_paths = ['/favicon.ico'];
    });

    // A GET on a connection of its own; null when no answer comes in time.
    function get_status(path, headers = {}) {
        return new Promise(function (resolve) {
            const u = new URL(config.public_url);
            const req = http.request({host: u.hostname, port: u.port, method: 'GET', path, headers, agent: false}, function (res) {
                res.resume();
                res.on('end', () => resolve(res.statusCode));
            });
            req.on('error', () => resolve(null));
            req.setTimeout(3000, () => req.destroy());
            req.end();
        });
    }

    // POSTs to a public path that announce a body and never finish it.
    async function hold_half_sent(count) {
        const u = new URL(config.public_url);
        const out = [];
        for (let i = 0; i < count; i++) {
            const socket = net.connect(u.port, u.hostname);
            socket.on('error', () => null);
            socket.write('POST /favicon.ico HTTP/1.1\r\nHost: x\r\nContent-Length: 1000000\r\n\r\nx');
            out.push(socket);
        }
        await new Promise(v => setTimeout(v, 1000));
        return out;
    }

    it('answers Ann and /favicon.ico while 256 half-sent requests are held (AW-122)', async function () {
        this.timeout(20000);
        await this.sign_in({username: 'ann', password: 'anns-pass-123'});
        const cookie = Array.from(this.client.cookies.values()).join('; ');

        const held = await hold_half_sent(256);
        try {
            assert.strictEqual(await get_status('/private', {cookie}), 200);
            assert.strictEqual(await get_status('/favicon.ico'), 200);
        }
        finally {
            for (const socket of held) {
                socket.destroy();
            }
        }
    });

});
