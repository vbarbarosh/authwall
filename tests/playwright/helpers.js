const {expect} = require('@playwright/test');

async function sign_in_as_seeded_user(page, options = {})
{
    const path = options.path || '/auth/sign-in';

    await page.goto(path);

    // Wait for the sign-in view and the CSRF token to be ready before
    // submitting — the token is populated asynchronously by api_status()
    await expect(page.getByTestId('signin-view')).toBeVisible();
    await expect(page.getByTestId('signin-csrf')).toHaveValue(/.+/);

    await page.getByTestId('signin-username').fill('foo');
    await page.getByTestId('signin-password').fill('foo');

    await Promise.all([
        page.waitForURL(url => url.pathname !== '/auth/sign-in'),
        page.getByTestId('signin-submit').click(),
    ]);
}

module.exports = {
    sign_in_as_seeded_user,
};
