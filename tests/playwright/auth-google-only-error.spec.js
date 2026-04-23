const {test, expect} = require('@playwright/test');

test.describe('auth spa google-only error', function () {

    test('shows sign-in error even when password flow is hidden', async function ({page}) {
        await page.route('/auth/status', route => route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                error: 'Email is not allowed',
                authenticated: false,
                csrf_token: 'csrf',
                flows: {
                    google: {},
                },
            }),
        }));

        await page.goto('/auth/sign-in');

        await expect(page.getByTestId('signin-view')).toBeVisible();
        await expect(page.getByTestId('signin-google')).toBeVisible();
        await expect(page.getByTestId('signin-form')).toBeHidden();
        await expect(page.getByTestId('signin-error')).toBeVisible();
        await expect(page.getByTestId('signin-error')).toContainText('Email is not allowed');
    });

});
