const sign_up_with_primary = require('./sign_up_with_primary');
const {test, expect} = require('@playwright/test');

// A post that gets no answer, or a proxy's error page instead of Authwall's,
// is an error on the page, never shown as done, and its button comes back
// (M-14).
const FAILURES = [
    {
        name: 'unreachable',
        answer: v => v.abort('failed'),
        message: 'Authwall could not be reached. Check the connection and try again.',
    },
    {
        name: 'a proxy 502',
        answer: v => v.fulfill({status: 502, contentType: 'text/html', body: '<html><body><h1>502 Bad Gateway</h1></body></html>'}),
        message: 'The request did not go through (HTTP 502). Try again.',
    },
];

// The posts of `path` get the failure; everything else goes through.
async function fail_posts(page, path, failure)
{
    await page.route(`**${path}`, function (route) {
        if (route.request().method() === 'POST') {
            return failure.answer(route);
        }
        return route.continue();
    });
}

test.describe('a post that does not reach Authwall', function () {

    for (const failure of FAILURES) {

        test(`confirming with the password, ${failure.name}: still asked, never confirmed`, async function ({page}) {
            await sign_up_with_primary(page);
            await page.goto('/auth/confirm');
            await fail_posts(page, '/auth/confirm', failure);

            await page.getByTestId('confirm-password').fill('pass1234');
            await page.getByTestId('confirm-password-submit').click();
            await expect(page.locator('#cf-error-msg')).toHaveText(failure.message);
            await expect(page.getByTestId('confirm-view')).toBeVisible();
            await expect(page.getByTestId('confirm-password-submit')).toHaveText('Confirm with password');
            await expect(page.getByTestId('confirm-password-submit')).toBeEnabled();
            const status = await (await page.request.get('/auth/status')).json();
            expect(status.confirmed).toBe(false);
        });

        test(`asking for an email change, ${failure.name}: the form says so`, async function ({page}) {
            await sign_up_with_primary(page);
            await page.goto('/auth/email-change/request');
            await fail_posts(page, '/auth/email-change/request', failure);

            await page.getByTestId('email-change-email').fill('new-address@authwall.test');
            await page.getByTestId('email-change-submit').click();
            await expect(page.locator('#ecr-error-msg')).toHaveText(failure.message);
            await expect(page.getByTestId('email-change-submit')).toHaveText('Request change');
            await expect(page).toHaveURL(/\/auth\/email-change\/request$/);
        });

        test(`saving the profile, ${failure.name}: no "Profile saved."`, async function ({page}) {
            await sign_up_with_primary(page);
            await page.goto('/auth/profile');
            await fail_posts(page, '/auth/profile', failure);

            await page.locator('#p-name').fill('A new name');
            await page.locator('#p-save').click();
            await expect(page.locator('#p-save-error-msg')).toHaveText(failure.message);
            await expect(page.locator('#p-save-ok')).toBeHidden();
            await expect(page.locator('#p-save')).toHaveText('Save changes');
        });

        test(`signing out, ${failure.name}: still signed in, and told so`, async function ({page}) {
            await sign_up_with_primary(page);
            await page.goto('/auth/sign-out');
            await fail_posts(page, '/auth/sign-out', failure);

            await page.getByTestId('signout-submit').click();
            await expect(page.getByTestId('signout-error')).toHaveText(failure.message);
            await expect(page.getByTestId('signout-view')).toBeVisible();
            await expect(page.getByTestId('signout-submit')).toBeEnabled();
            const status = await (await page.request.get('/auth/status')).json();
            expect(status.authenticated).toBe(true);
        });
    }

});
