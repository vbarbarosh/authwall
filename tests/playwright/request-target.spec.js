const net = require('net');
const {sign_in_as_seeded_user} = require('./helpers');
const {test, expect} = require('@playwright/test');

// A browser keeps the fragment to itself, so the 400 for "#" on the wire
// (AW-22) never reaches a page; only a hand-written request line carries one.
test.describe('request target with a fragment', function () {

    test('a raw request line with "#" gets 400 and never reaches the upstream', async function () {
        const r = await raw_get('/favicon.ico#/../admin.txt');

        expect(r.status).toBe(400);
        expect(r.data).not.toContain('"url"');
    });

    test('a browser opens a public path with a fragment anonymously', async function ({page}) {
        const response = await page.goto('/favicon.ico#/../admin.txt');

        expect(response.status()).toBe(200);
        const echo = await response.json();
        expect(echo.url).toBe('/favicon.ico');
        expect(echo.headers['x-auth-user']).toBeUndefined();
    });

    test('a browser is sent to sign-in for a protected path with a fragment', async function ({page}) {
        await page.goto('/private/page#section');

        await expect(page.getByTestId('signin-view')).toBeVisible();
        expect(new URL(page.url()).pathname).toBe('/auth/sign-in');
    });

    test('a signed-in browser opens a protected path with a fragment', async function ({page}) {
        await sign_in_as_seeded_user(page);

        const response = await page.goto('/private/page#section');

        expect(response.status()).toBe(200);
        const echo = await response.json();
        expect(echo.url).toBe('/private/page');
        expect(echo.headers['x-auth-user']).toMatch(/^awuser_/);
    });

});

function raw_get(target)
{
    return new Promise(function (resolve, reject) {
        const socket = net.connect(3000, '127.0.0.1');
        let data = '';
        socket.on('connect', () => socket.write(`GET ${target} HTTP/1.1\r\nHost: localhost:3000\r\nConnection: close\r\n\r\n`));
        socket.on('data', v => data += v);
        socket.on('error', reject);
        socket.on('close', () => resolve({status: Number((data.match(/^HTTP\/1\.1 (\d+)/) || [])[1]), data}));
    });
}
