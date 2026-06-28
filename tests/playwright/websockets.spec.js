const {sign_in_as_seeded_user} = require('./helpers');
const {test, expect} = require('@playwright/test');

test.describe('browser websockets', function () {

    test('signed-in browser opens a cookie-authenticated websocket', async function ({page}) {
        await sign_in_as_seeded_user(page);

        const result = await websocket_roundtrip(page, '/realtime');

        expect(result.opened).toBe(true);
        expect(result.echo).toBe('ping');
        expect(result.upstream_headers['x-auth-user']).toMatch(/^awuser_/);
        expect(result.upstream_headers.cookie).toContain('connect.sid=');
    });

    test('anonymous browser websocket is rejected', async function ({page}) {
        await page.goto('/auth/sign-in');

        const result = await websocket_roundtrip(page, '/realtime');

        expect(result.opened).toBe(false);
        expect(result.error).toBe('error');
        expect(result.close_code).toBe(1006);
    });

});

async function websocket_roundtrip(page, path)
{
    return page.evaluate(function ({path}) {
        return new Promise(function (resolve) {
            const url = new URL(path, window.location.href);
            url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

            const socket = new WebSocket(url.href);
            const result = {
                opened: false,
                upstream_headers: null,
                echo: null,
                error: null,
                close_code: null,
            };
            const timer = setTimeout(finish, 4000, 'timeout');

            socket.addEventListener('open', function () {
                result.opened = true;
            });
            socket.addEventListener('message', function (event) {
                const message = JSON.parse(event.data);
                if (message.type === 'upstream_open') {
                    result.upstream_headers = message.headers;
                    socket.send('ping');
                }
                else if (message.type === 'echo') {
                    result.echo = message.data;
                    finish();
                }
            });
            socket.addEventListener('error', function () {
                result.error = 'error';
            });
            socket.addEventListener('close', function (event) {
                result.close_code = event.code;
                if (!result.echo) {
                    finish();
                }
            });

            function finish(error) {
                if (finish.done) {
                    return;
                }
                finish.done = true;
                clearTimeout(timer);
                if (error && !result.error) {
                    result.error = error;
                }
                try { socket.close(); } catch {}
                resolve(result);
            }
        });
    }, {path});
}
