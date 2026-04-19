const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const {test, expect} = require('@playwright/test');

test.describe('auth spa anonymous', function () {

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

    test('sign-up footer sign-in link returns to sign-in', async function ({page}) {
        await page.goto('/auth/sign-up');

        await page.getByRole('link', {name: 'Sign in'}).click();

        await expect(page).toHaveURL('http://localhost:3000/auth/sign-in');
        await expect(page.getByTestId('signin-view')).toBeVisible();
        await expect(page.getByTestId('signup-view')).toBeHidden();
    });

    test('sign-up route hides email field when email password flow is disabled', async function ({page}) {
        await page.route('/auth/status', route => route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                error: null,
                authenticated: false,
                csrf_token: 'csrf',
                flows: {
                    password: {
                        allow_username: true,
                        allow_email: false,
                        min_password_length: 8,
                    },
                },
            }),
        }));

        await page.goto('/auth/sign-up');

        await expect(page.getByTestId('signup-view')).toBeVisible();
        await expect(page.locator('#su-email-field')).toBeHidden();
        await expect(page.locator('#su-user-field')).toBeVisible();
    });

    test('unauthenticated user hitting profile is sent to sign-in', async function ({page}) {
        await page.goto('/auth/profile');

        await expect(page).toHaveURL(urlmod('http://localhost:3000/auth/sign-in', {return: '/auth/profile'}));
        await expect(page.getByTestId('signin-view')).toBeVisible();
    });

    test('unauthenticated user hitting sessions is sent to sign-in', async function ({page}) {
        await page.goto('/auth/sessions');

        await expect(page).toHaveURL(urlmod('http://localhost:3000/auth/sign-in', {return: '/auth/sessions'}));
        await expect(page.getByTestId('signin-view')).toBeVisible();
    });

    test('unauthenticated user hitting sign-out is sent to sign-in', async function ({page}) {
        await page.goto('/auth/sign-out');

        await expect(page).toHaveURL(urlmod('http://localhost:3000/auth/sign-in', {return: '/auth/sign-out'}));
        await expect(page.getByTestId('signin-view')).toBeVisible();
    });

    test('failed sign-in stays on sign-in and shows an error', async function ({page}) {
        await page.goto('/auth/sign-in');

        await expect(page.getByTestId('signin-view')).toBeVisible();
        await expect(page.locator('#si-csrf')).toHaveValue(/.+/);

        await page.getByTestId('signin-username').fill('foo');
        await page.getByTestId('signin-password').fill('wrong-password');
        await page.getByTestId('signin-submit').click();

        await expect(page).toHaveURL('http://localhost:3000/auth/sign-in');
        await expect(page.getByTestId('signin-view')).toBeVisible();
        await expect(page.getByTestId('signin-error')).toBeVisible();
        await expect(page.getByTestId('signin-error')).toContainText('Invalid username or password');
    });

    test('magic-link request reaches sent view', async function ({page, browserName}) {
        await page.goto('/auth/magic-link');

        await expect(page.getByTestId('magic-request-view')).toBeVisible();
        await page.getByTestId('magic-request-email').fill(`playwright-magic-${browserName}-${Date.now()}@authwall.test`);
        await page.getByTestId('magic-request-submit').click();

        await expect(page).toHaveURL('http://localhost:3000/auth/magic-link/sent');
        await expect(page.getByTestId('magic-sent-view')).toBeVisible();
    });

});
