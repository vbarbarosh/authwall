const {test, expect} = require('@playwright/test');

test.describe('auth spa smoke', function () {

    test('sign-in route exposes the stable sign-in contract', async function ({page}) {
        await page.goto('/auth/sign-in');

        await expect(page.getByTestId('signin-view')).toBeVisible();
        await expect(page.getByTestId('signin-form')).toBeVisible();
        await expect(page.getByTestId('signin-username')).toBeVisible();
        await expect(page.getByTestId('signin-password')).toBeVisible();
        await expect(page.getByTestId('signin-submit')).toBeVisible();
        await expect(page.getByTestId('signin-google')).toBeVisible();
        await expect(page.getByTestId('signin-github')).toBeVisible();
    });

    test('sign-up route exposes oauth entry points', async function ({page}) {
        await page.goto('/auth/sign-up');

        await expect(page.getByTestId('signup-view')).toBeVisible();
        await expect(page.getByTestId('signup-google')).toBeVisible();
        await expect(page.getByTestId('signup-github')).toBeVisible();
    });

    test('unauthenticated user hitting profile is sent to sign-in', async function ({page}) {
        await page.goto('/auth/profile');

        await expect(page).toHaveURL('http://localhost:3000/auth/sign-in?return=%2Fauth%2Fprofile');
        await expect(page.getByTestId('signin-view')).toBeVisible();
    });

    test('unauthenticated user hitting sessions is sent to sign-in', async function ({page}) {
        await page.goto('/auth/sessions');

        await expect(page).toHaveURL('http://localhost:3000/auth/sign-in?return=%2Fauth%2Fsessions');
        await expect(page.getByTestId('signin-view')).toBeVisible();
    });

    test('failed sign-in stays on sign-in and shows an error', async function ({page}) {
        await page.goto('/auth/sign-in');

        await page.getByTestId('signin-username').fill('foo');
        await page.getByTestId('signin-password').fill('wrong-password');
        await page.getByTestId('signin-submit').click();

        await expect(page).toHaveURL('http://localhost:3000/auth/sign-in');
        await expect(page.getByTestId('signin-view')).toBeVisible();
        await expect(page.getByTestId('signin-error')).toBeVisible();
        await expect(page.getByTestId('signin-error')).toContainText('Invalid username or password');
    });

    test('successful sign-in honors return to sessions', async function ({page}) {
        await sign_in_as_seeded_user(page, {path: '/auth/sign-in?return=%2Fauth%2Fsessions'});

        await expect(page).toHaveURL('http://localhost:3000/auth/sessions');
        await expect(page.getByTestId('sessions-view')).toBeVisible();
    });

    test('magic-link request reaches sent view', async function ({page, browserName}) {
        await page.goto('/auth/magic-link');

        await expect(page.getByTestId('magic-request-view')).toBeVisible();
        await page.getByTestId('magic-request-email').fill(`playwright-magic-${browserName}-${Date.now()}@authwall.test`);
        await page.getByTestId('magic-request-submit').click();

        await expect(page).toHaveURL('http://localhost:3000/auth/magic-link/sent');
        await expect(page.getByTestId('magic-sent-view')).toBeVisible();
    });

    test('seeded user can sign in and see profile connections', async function ({page}) {
        await sign_in_as_seeded_user(page);

        await expect(page).toHaveURL('http://localhost:3000/');

        await page.goto('/auth/profile');
        await expect(page.getByTestId('profile-view')).toBeVisible();
        await expect(page.getByTestId('profile-connections')).toBeVisible();

        await page.goto('/auth/sign-out');
        await expect(page.getByTestId('signout-view')).toBeVisible();
        await page.getByTestId('signout-submit').click();

        await expect(page).toHaveURL('http://localhost:3000/auth/sign-in');
        await expect(page.getByTestId('signin-view')).toBeVisible();
    });

});

async function sign_in_as_seeded_user(page, options = {})
{
    const path = options.path || '/auth/sign-in';
    await page.goto(path);
    await page.getByTestId('signin-username').fill('foo');
    await page.getByTestId('signin-password').fill('foo');
    await page.getByTestId('signin-submit').click();
}
