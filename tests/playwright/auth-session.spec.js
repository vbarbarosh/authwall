const {test, expect} = require('@playwright/test');
const {sign_in_as_seeded_user} = require('./helpers');

test.describe('auth spa session', function () {

    test('successful sign-in honors return to sessions', async function ({page}) {
        await sign_in_as_seeded_user(page, {path: '/auth/sign-in?return=%2Fauth%2Fsessions'});

        await expect(page).toHaveURL('http://localhost:3000/auth/sessions');
        await expect(page.getByTestId('sessions-view')).toBeVisible();
    });

    test('seeded user can sign in and see profile connections', async function ({page}) {
        await sign_in_as_seeded_user(page);

        await expect(page).toHaveURL('http://localhost:3000/');

        await page.goto('/auth/profile');
        await expect(page.getByTestId('profile-view')).toBeVisible();
        await expect(page.getByTestId('profile-connections')).toBeVisible();
    });

    test('sessions view shows the current device badge', async function ({page}) {
        await sign_in_as_seeded_user(page, {path: '/auth/sessions'});

        await expect(page).toHaveURL('http://localhost:3000/auth/sessions');
        await expect(page.getByTestId('sessions-view')).toBeVisible();
        await expect(page.getByText('This device')).toBeVisible();
    });

    test('sign-out returns the user to sign-in', async function ({page}) {
        await sign_in_as_seeded_user(page);

        await page.goto('/auth/sign-out');
        await expect(page.getByTestId('signout-view')).toBeVisible();
        await page.getByTestId('signout-submit').click();

        await expect(page).toHaveURL('http://localhost:3000/auth/sign-in');
        await expect(page.getByTestId('signin-view')).toBeVisible();
    });

});
