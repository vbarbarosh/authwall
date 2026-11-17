const bcrypt = require('bcrypt');
const open_e2e_db = require('./open_e2e_db');
const random_uid_user_identity = require('../../src/helpers/random/random_uid_user_identity');
const {test, expect} = require('@playwright/test');

const STATES = [
    {name: 'normal', email: 'reader@example.com', width: 720},
    {name: 'empty', email: '', width: 320},
    {name: 'tiny', email: 'a', width: 320},
    {name: 'long', email: `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.example.com`, width: 320},
    {name: 'absurd', email: 'x'.repeat(600), width: 320},
];

test.describe('magic request notice', function () {
    for (const mode of ['link', 'code', 'link_and_code']) {
        for (const state of STATES) {
            test(`explains delivery and browser restrictions in ${mode} mode: ${state.name}`, async function ({page}, test_info) {
                await page.setViewportSize({width: state.width, height: 900});
                await page.route('http://authwall.test/**', async function (route) {
                    const url = new URL(route.request().url());
                    url.host = 'localhost:3000';
                    const response = await route.fetch({url: url.toString()});
                    await route.fulfill({response});
                });
                await page.route('http://authwall.test/auth/status', function (route) {
                    return route.fulfill({json: {
                        authenticated: false, csrf_token: 'csrf', error: null,
                        flows: {magic_link: {mode}}, actions: {can_sign_up: false},
                    }});
                });
                await page.goto(`http://authwall.test/auth/magic-link/sent?email=${encodeURIComponent(state.email)}`);
                const notice = page.getByTestId('magic-sent-view');
                await expect(notice).toBeVisible();
                await expect(page.getByTestId('magic-notice-title')).toHaveText('Check your email');
                await expect(page.getByTestId('magic-notice-cooldown')).toContainText('Asking again within a minute sends nothing new.');
                await expect(page.locator('#ml-sent-email')).toHaveText(state.email || 'your email');
                await expect(notice).not.toContainText('have been sent');
                if (mode === 'link') {
                    await expect(page.getByTestId('magic-notice-code')).toBeHidden();
                    await expect(page.getByTestId('magic-notice-browser')).toBeHidden();
                }
                else {
                    await expect(page.getByTestId('magic-notice-code')).toBeVisible();
                    await expect(page.getByTestId('magic-notice-browser')).toContainText('The code works only in the browser that asked.');
                }
                await expect(page.locator('#preloader')).toHaveCount(0);
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
                const message = await page.getByTestId('magic-notice-cooldown').boundingBox();
                const retry = await page.getByTestId('magic-notice-retry').boundingBox();
                expect(retry.y).toBeGreaterThanOrEqual(message.y + message.height);
                await page.screenshot({path: test_info.outputPath('notice.png'), fullPage: true});

                if (mode !== 'link') {
                    await page.getByTestId('magic-notice-code').click();
                    await expect(page.getByTestId('magic-confirm-view')).toContainText('It works only in the browser that asked.');
                    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
                    await page.screenshot({path: test_info.outputPath('confirm.png'), fullPage: true});
                    await page.goBack();
                }
                await page.getByTestId('magic-notice-retry').click();
                await expect(page.getByTestId('magic-request-view')).toBeVisible();
                await expect(page.getByTestId('magic-request-email')).toHaveValue(state.email);
            });
        }
    }

    test('a second browser gets truthful retry instructions while the original code still works', async function ({page, browser, baseURL}, test_info) {
        await using db = open_e2e_db();
        const email = `notice-${random_uid_user_identity()}@authwall.test`;
        const owner = await db('user_identities').where({type: 'username', value_normalized: 'foo'}).first();
        const now = new Date();
        await db('user_identities').insert({
            uid: random_uid_user_identity(), user_id: owner.user_id, type: 'email', value: email, value_normalized: email,
            verified_at: now, created_at: now, updated_at: now,
        });
        await page.goto('/auth/magic-link');
        await page.getByTestId('magic-request-email').fill(email);
        await page.getByTestId('magic-request-submit').click();
        await expect(page.getByTestId('magic-sent-view')).toBeVisible();
        await expect(page.getByTestId('magic-notice-title')).toHaveText('Check your email');
        const original_notice = await page.getByTestId('magic-sent-view').innerText();
        const challenge = await db('magic_links').where({email_normalized: email}).first();

        // The e2e mailer delivers nothing; give the issued challenge a known
        // code to exercise the real browser binding and confirmation route.
        const code = '123456';
        await db('magic_links').where({id: challenge.id}).update({code_hash: await bcrypt.hash(code, 4)});
        const second_context = await browser.newContext({baseURL, viewport: {width: 320, height: 900}});
        try {
            const second = await second_context.newPage();
            await second.goto('/auth/magic-link');
            await second.getByTestId('magic-request-email').fill(email);
            await second.getByTestId('magic-request-submit').click();
            await expect(second.getByTestId('magic-sent-view')).toBeVisible();
            await expect(second.getByTestId('magic-notice-title')).toHaveText('Check your email');
            expect(await second.getByTestId('magic-sent-view').innerText()).toBe(original_notice);
            await expect(second.getByTestId('magic-notice-browser')).toContainText('The code works only in the browser that asked.');
            expect((await db('magic_links').where({email_normalized: email})).length).toBe(1);
            await second.screenshot({path: test_info.outputPath('second-browser.png'), fullPage: true});
            await second.getByTestId('magic-notice-retry').click();
            await expect(second.getByTestId('magic-request-email')).toHaveValue(email);

            await page.getByTestId('magic-notice-code').click();
            const inputs = page.getByTestId('magic-confirm-view').locator('.otp-input');
            for (let i = 0; i < code.length; ++i) {
                await inputs.nth(i).fill(code[i]);
            }
            await page.getByTestId('magic-confirm-submit').click();
            await expect(page.getByTestId('magic-confirm-view')).toBeHidden();
            const status = await (await page.request.get('/auth/status')).json();
            expect(status.authenticated).toBe(true);

            // Advance just the email cooldown; no minute-long test sleep.
            await db('magic_links').where({id: challenge.id}).update({created_at: new Date(Date.now() - 61*1000)});
            await second.getByTestId('magic-request-submit').click();
            await expect(second.getByTestId('magic-sent-view')).toBeVisible();
            await expect(second.getByTestId('magic-notice-title')).toHaveText('Check your email');
            expect((await db('magic_links').where({email_normalized: email})).length).toBe(2);
            const fresh = await db('magic_links').where({email_normalized: email}).orderBy('id', 'desc').first();
            await db('magic_links').where({id: fresh.id}).update({code_hash: await bcrypt.hash(code, 4)});
            await second.getByTestId('magic-notice-code').click();
            const fresh_inputs = second.getByTestId('magic-confirm-view').locator('.otp-input');
            for (let i = 0; i < code.length; ++i) {
                await fresh_inputs.nth(i).fill(code[i]);
            }
            await second.getByTestId('magic-confirm-submit').click();
            await expect(second.getByTestId('magic-confirm-view')).toBeHidden();
            const fresh_status = await (await second.request.get('/auth/status')).json();
            expect(fresh_status.authenticated).toBe(true);
        }
        finally {
            await second_context.close();
        }
    });
});
