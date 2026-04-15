const {expect} = require('@playwright/test');

async function sign_in_as_seeded_user(page, options = {})
{
    const path = options.path || '/auth/sign-in';

    await page.goto(path);

    await expect(page.getByTestId('signin-view')).toBeVisible();
    await expect(page.locator('#si-csrf')).toHaveValue(/.+/);

    await page.getByTestId('signin-username').fill('foo');
    await page.getByTestId('signin-password').fill('foo');

    await Promise.all([
        page.waitForURL(url => url.pathname !== '/auth/sign-in'),
        page.getByTestId('signin-submit').click(),
    ]);

    await page.waitForFunction(async function () {
        const res = await fetch('/auth/status', {credentials: 'same-origin'});
        if (!res.ok) {
            return false;
        }
        const status = await res.json();
        return Boolean(status.authenticated && status.csrf_token);
    });
}

module.exports = {
    sign_in_as_seeded_user,
};
