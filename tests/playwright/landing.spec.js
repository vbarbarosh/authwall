const {expect, test} = require('@playwright/test');

// The SPA goes where a post lands itself, once; the sign-in form and the SPA
// both reach a return on a subdomain of the public host (AW-32). The e2e
// server answers wiki.localhost too, as itself: its cookie is the public
// host's alone, so the wiki asks to sign in there, and the browser getting
// there is what is checked.
test.describe('landing after sign-in or sign-up', function () {

    const WIKI = 'http://wiki.localhost:3000/page';

    async function sign_in(page, path) {
        await page.goto(path);
        await expect(page.getByTestId('signin-csrf')).toHaveValue(/.+/);
        await page.getByTestId('signin-username').fill('foo');
        await page.getByTestId('signin-password').fill('foo');
        await page.getByTestId('signin-submit').click();
    }

    async function sign_up(page, path) {
        const username = `land${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        await page.goto(path);
        await expect(page.getByTestId('signup-view')).toBeVisible();
        await page.locator('#su-user').fill(username);
        await page.locator('#su-pass').fill('pass1234');
        await page.locator('#su-pass2').fill('pass1234');
        await page.locator('#su-submit').click();
    }

    test('a sign-up loads the page it returns to once', async function ({page}) {
        const probe = `/probe-landing-${Date.now()}`;
        const loads = [];
        page.on('request', function (request) {
            if (new URL(request.url()).pathname === probe) {
                loads.push(request.resourceType());
            }
        });

        await sign_up(page, `/auth/sign-up?return=${encodeURIComponent(probe)}`);
        await page.waitForURL(v => v.pathname === probe);
        await expect(page.locator('body')).toContainText('authwall_testing_echo_server');
        expect(loads).toEqual(['document']);
    });

    test('a sign-up lands on a subdomain return', async function ({page}) {
        const landing = page.waitForRequest(WIKI);
        await sign_up(page, `/auth/sign-up?return=${encodeURIComponent(WIKI)}`);
        expect((await landing).isNavigationRequest()).toBe(true);
        await page.waitForURL(v => v.hostname === 'wiki.localhost');
    });

    test('the sign-in form lands on a subdomain return', async function ({page}) {
        const landing = page.waitForRequest(WIKI);
        await sign_in(page, `/auth/sign-in?return=${encodeURIComponent(WIKI)}`);
        expect((await landing).isNavigationRequest()).toBe(true);
        await page.waitForURL(v => v.hostname === 'wiki.localhost');
    });

});
