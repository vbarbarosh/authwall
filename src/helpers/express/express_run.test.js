const als = require('../als');
const assert = require('assert');
const express = require('express');
const express_run = require('./express_run');
const http = require('http');

describe('express_run', function () {
    let sigint_listeners;
    let sigterm_listeners;

    beforeEach(function () {
        sigint_listeners = process.listeners('SIGINT');
        sigterm_listeners = process.listeners('SIGTERM');
    });

    afterEach(function () {
        assert.deepStrictEqual(process.listeners('SIGINT'), sigint_listeners);
        assert.deepStrictEqual(process.listeners('SIGTERM'), sigterm_listeners);
    });

    it('calls ready after listening and setup, and resolves on close', async function () {
        const app = express();
        let setup_server;
        let ready_count = 0;
        app.setup_server = function (server) {
            setup_server = server;
        };
        await run(app, 0, function (server) {
            ready_count++;
            assert.strictEqual(server, setup_server);
            assert.strictEqual(server.address().address, '127.0.0.1');
            assert.ok(server.address().port > 0);
            server.close();
        });
        assert.strictEqual(ready_count, 1);
        assert.strictEqual(setup_server.listening, false);
    });

    it('rejects with EADDRINUSE without calling ready or leaking signal listeners', async function () {
        await using occupied = http.createServer();
        await new Promise(function (resolve) {
            occupied.listen(0, '127.0.0.1', resolve);
        });
        let ready_count = 0;
        for (let i = 0; i < 2; i++) {
            const running = run(express(), occupied.address().port, function () {
                ready_count++;
            });
            await assert.rejects(running, {code: 'EADDRINUSE', syscall: 'listen'});
        }
        assert.strictEqual(ready_count, 0);
    });

    it('rejects a synchronous listen error', async function () {
        await assert.rejects(run(express(), 65536), {code: 'ERR_SOCKET_BAD_PORT'});
    });

    it('closes the server and rejects when ready throws', async function () {
        let started;
        const running = run(express(), 0, function (server) {
            started = server;
            throw new Error('ready failed');
        });
        await assert.rejects(running, {message: 'ready failed'});
        assert.strictEqual(started.listening, false);
    });

    it('closes the server and rejects when setup throws', async function () {
        const app = express();
        let started;
        let ready_count = 0;
        app.setup_server = function (server) {
            started = server;
            throw new Error('setup failed');
        };
        const running = run(app, 0, function () {
            ready_count++;
        });
        await assert.rejects(running, {message: 'setup failed'});
        // Drain pending listen/close work before checking for a leaked socket.
        await new Promise(function (resolve) {
            setImmediate(resolve);
        });
        assert.strictEqual(started.listening, false);
        assert.strictEqual(ready_count, 0);
    });

    it('logs readiness with the default callback', async function () {
        const logs = [];
        const app = express();
        app.setup_server = function (server) {
            server.once('listening', () => server.close());
        };
        await als.run({logger: {write: v => logs.push(v)}}, () => express_run(app, 0, '127.0.0.1'));
        assert.match(logs[0], /Listening to 127\.0\.0\.1:\d+/);
        assert.strictEqual(logs[1], '[express_run] closed');
    });
});

function run(app, port, ready)
{
    return als.run({logger: {write: () => null}}, () => express_run(app, port, '127.0.0.1', ready));
}
