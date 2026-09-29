const open_e2e_db = require('./open_e2e_db');
const sign_up_with_primary = require('./sign_up_with_primary');
const {test, expect} = require('@playwright/test');

// The confirmation view (AW-24) and the "Primary" badge.
test.describe('confirm it is you', function () {

    test('the profile marks the primary address', async function ({page}) {
        const {email} = await sign_up_with_primary(page);

        await page.goto('/auth/profile');
        const row = page.getByTestId('profile-connections').locator('.connection-item', {hasText: email});
        await expect(row.getByTestId('primary-badge')).toHaveText('Primary');
    });

    test('confirms with the password and returns to the profile', async function ({page}) {
        const {email} = await sign_up_with_primary(page);

        await page.goto('/auth/confirm');
        await expect(page.getByTestId('confirm-reason')).toHaveText('Confirm it is you to continue.');
        await expect(page.getByTestId('confirm-view')).toContainText(`Enter the code we sent to ${email}.`);

        await page.getByTestId('confirm-password').fill('wrong-password');
        await page.getByTestId('confirm-password-submit').click();
        await expect(page.locator('#cf-error-msg')).toHaveText('Password is incorrect');

        await page.getByTestId('confirm-password').fill('pass1234');
        await page.getByTestId('confirm-password-submit').click();
        await expect(page.getByTestId('profile-view')).toBeVisible();
        const status = await (await page.request.get('/auth/status')).json();
        expect(status.confirmed).toBe(true);
    });

    test('offers a fresh sign-in with each linked provider account', async function ({page}) {
        const {user_id} = await sign_up_with_primary(page);
        await using db = open_e2e_db();
        const now = new Date();
        await db('user_identities').insert({uid: `awident_g${user_id}`, user_id, type: 'oauth_google', value: `g${user_id}`, value_normalized: `g${user_id}`, created_at: now, updated_at: now, verified_at: now});

        await page.goto('/auth/confirm');
        const button = page.getByTestId('confirm-provider-oauth_google');
        await expect(button).toHaveText('Sign in again with Google');
        await expect(button).toHaveAttribute('href', '/auth/google?confirm=1');
    });

    test('explains a pending connect and continues to it after confirming', async function ({page}) {
        const {email} = await sign_up_with_primary(page);
        // A real connect needs the provider; the pending confirmation it leaves
        // in the session is added to the page's status responses instead.
        await page.route('**/auth/status', async function (route) {
            const response = await route.fetch();
            const json = await response.json();
            json.confirmation = {next: '/auth/profile?continued=1', provider: 'oauth_google', provider_emails: ['me@gmail.test']};
            await route.fulfill({response, json});
        });

        await page.goto('/auth/confirm');
        await expect(page.getByTestId('confirm-reason')).toHaveText(`The Google account you are connecting (me@gmail.test) does not use your primary address (${email}). Confirm it is you to connect it.`);

        await page.getByTestId('confirm-password').fill('pass1234');
        await page.getByTestId('confirm-password-submit').click();
        await page.waitForURL(v => v.search === '?continued=1');
        // The profile's own status request may still be in the route.
        await page.unrouteAll({behavior: 'ignoreErrors'});
    });

});
