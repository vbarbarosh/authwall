const {test, expect} = require('@playwright/test');

// A sign-in asked for /hello: every way in keeps it, as the password form does.
test.describe('the page a sign-in was asked for', function () {

    test('rides along the magic link pages and their posts', async function ({page}, test_info) {
        await page.goto('/auth/sign-in?return=%2Fhello');
        await page.getByRole('button', {name: 'Send me a magic link'}).click();
        await expect(page).toHaveURL(/\/auth\/magic-link\?return=%2Fhello$/);

        const request = page.waitForRequest(v => (v.method() === 'POST') && v.url().includes('/auth/magic-link/request'));
        await page.getByTestId('magic-request-email').fill(`ann-${test_info.project.name}-${Date.now()}@authwall.test`);
        await page.getByTestId('magic-request-submit').click();
        expect(new URL((await request).url()).searchParams.get('return')).toBe('/hello');
        await expect(page.getByTestId('magic-sent-view')).toBeVisible();
        await expect(page).toHaveURL(/\/auth\/magic-link\/sent\?return=%2Fhello$/);

        await page.getByTestId('magic-notice-code').click();
        await expect(page).toHaveURL(/\/auth\/magic-link\/confirm\?return=%2Fhello$/);
    });

    test('opens the mailed link with it', async function ({page}) {
        await page.route(v => v.pathname === '/auth/magic-link/confirm/open', function (route) {
            if (route.request().method() === 'GET') {
                return route.fulfill({json: {error: null, email: 'ann@authwall.test'}});
            }
            return route.fulfill({json: {next: '/auth/sign-in'}});
        });
        const opened = page.waitForRequest(v => (v.method() === 'POST') && v.url().includes('/auth/magic-link/confirm/open'));
        await page.goto('/auth/magic-link/confirm?token=abc&return=%2Fhello');
        await page.locator('#lk-submit:enabled').click();
        expect(new URL((await opened).url()).searchParams.get('return')).toBe('/hello');
    });

    test('takes it to the sign-up and lands there after it', async function ({page}, test_info) {
        await page.goto('/auth/sign-in?return=%2Fhello');
        await page.getByRole('link', {name: 'Create one'}).click();
        await expect(page).toHaveURL(/\/auth\/sign-up\?return=%2Fhello$/);

        const name = `ann_${test_info.project.name}_${Date.now()}`;
        await page.locator('#su-email').fill(`${name}@authwall.test`);
        await page.locator('#su-user').fill(name);
        await page.locator('#su-pass').fill('anns-pass-123');
        await page.locator('[data-view="sign-up"] input[type=password]:visible').last().fill('anns-pass-123');
        await page.locator('#su-submit').click();
        await page.waitForURL(/\/hello$/);
    });

    test('puts it on the providers\' buttons', async function ({page}) {
        await page.goto('/auth/sign-in?return=%2Fhello');
        await expect(page.getByTestId('signin-google')).toHaveAttribute('href', '/auth/google?return=%2Fhello');
        await expect(page.getByTestId('signin-github')).toHaveAttribute('href', '/auth/github?return=%2Fhello');
        await page.getByRole('link', {name: 'Create one'}).click();
        await expect(page.getByTestId('signup-google')).toHaveAttribute('href', '/auth/google?return=%2Fhello');

        await page.goto('/auth/sign-in');
        await expect(page.getByTestId('signin-google')).toHaveAttribute('href', '/auth/google');
    });

});
