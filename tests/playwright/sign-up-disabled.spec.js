const {sign_in_as_seeded_user} = require('./helpers');
const {test, expect} = require('@playwright/test');

const STATES = [
    {name: 'password', flows: {password: {allow_username: true, allow_email: true}}, control: 'signin-form', width: 720},
    {name: 'oauth', flows: {google: {}}, control: 'signin-google', width: 720},
    {name: 'magic', flows: {magic_link: {mode: 'link_and_code'}}, width: 320},
    {
        name: 'crowded', width: 320, control: 'signin-form',
        flows: {password: {allow_username: true, allow_email: true}, magic_link: {mode: 'link_and_code'}, google: {}, github: {}, microsoft: {}, facebook: {}, twitter: {}, discord: {}},
        error: 'Registration is closed. Sign in with an account that already exists. '.repeat(8),
    },
];

test.describe('signup disabled', function () {
    test.beforeEach(async function ({page}) {
        // Render the deployed layout: localhost enables the development toolbar.
        await page.route('http://authwall.test/**', async function (route) {
            const url = new URL(route.request().url());
            url.host = 'localhost:3000';
            const response = await route.fetch({url: url.toString()});
            await route.fulfill({response});
        });
    });

    for (const state of STATES) {
        test(`shows existing sign-in methods with signup closed: ${state.name}`, async function ({page}, test_info) {
            await page.setViewportSize({width: state.width, height: 900});
            await page.route('http://authwall.test/auth/status', function (route) {
                return route.fulfill({json: {
                    authenticated: false, csrf_token: 'csrf', error: state.error ?? null,
                    flows: state.flows, actions: {can_sign_up: false},
                }});
            });
            await page.goto('http://authwall.test/auth/sign-up?return=%2Fprivate');
            await expect(page.getByTestId('signin-view')).toBeVisible();
            await expect(page.getByTestId('signup-view')).toBeHidden();
            await expect(page.getByRole('link', {name: 'Create one'})).toBeHidden();
            await expect(page.getByTestId('signup-closed')).toBeVisible();
            if (state.name === 'magic') {
                await expect(page.getByRole('button', {name: 'Send me a magic link'})).toBeVisible();
            }
            else {
                await expect(page.getByTestId(state.control)).toBeVisible();
            }
            if (state.error) {
                await expect(page.getByTestId('signin-error')).toContainText(state.error.trim());
            }
            await expect(page.locator('#preloader')).toHaveCount(0);
            const notice = await page.getByTestId('signup-closed').boundingBox();
            const body = await page.getByTestId('signin-view').locator('.card-body').boundingBox();
            expect(notice.y + notice.height).toBeLessThanOrEqual(body.y);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            await page.screenshot({path: test_info.outputPath('closed.png'), fullPage: true});
        });
    }

    test('keeps signup available by default', async function ({page}, test_info) {
        await page.goto('http://authwall.test/auth/sign-in');
        await expect(page.getByRole('link', {name: 'Create one'})).toBeVisible();
        await expect(page.getByTestId('signup-closed')).toBeHidden();
        await page.getByRole('link', {name: 'Create one'}).click();
        await expect(page.getByTestId('signup-view')).toBeVisible();
        await expect(page.locator('#preloader')).toHaveCount(0);
        await page.screenshot({path: test_info.outputPath('enabled.png'), fullPage: true});
    });

    test('existing users can submit the sign-in form with signup hidden', async function ({page}) {
        await page.route('/auth/status', async function (route) {
            const response = await route.fetch();
            const status = await response.json();
            status.actions.can_sign_up = false;
            await route.fulfill({json: status});
        });
        await page.goto('/auth/sign-in');
        await expect(page.getByTestId('signup-closed')).toBeVisible();
        await expect(page.locator('.demo-btn[data-goto="sign-up"]')).toBeHidden();
        await expect(page.locator('.demo-btn[data-signup-mode]:visible')).toHaveCount(0);
        await sign_in_as_seeded_user(page);
        const response = await page.request.get('/auth/status');
        const status = await response.json();
        expect(status.authenticated).toBe(true);
    });
});
