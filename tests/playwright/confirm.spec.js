const knex = require('knex');
const os = require('os');
const path = require('path');
const {test, expect} = require('@playwright/test');

// The confirmation view (AW-24) and the "Primary" badge. The account is made
// through the API, and its address marked verified and primary in the database:
// the e2e mailer delivers nothing.
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
    });

});

async function sign_up_with_primary(page)
{
    const username = `pw${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const email = `${username}@authwall.test`;
    const status = await (await page.request.get('/auth/status')).json();
    await page.request.post('/auth/sign-up', {form: {username, email, password: 'pass1234', password_confirm: 'pass1234', _csrf: status.csrf_token}});

    await using db = open_e2e_db();
    const now = new Date();
    await db('user_identities').where({type: 'email', value_normalized: email}).update({verified_at: now, primary_at: now});
    const {user_id} = await db('user_identities').where({type: 'email', value_normalized: email}).first();
    return {username, email, user_id};
}

// The database the e2e server was started on (see playwright.config.js).
function open_e2e_db()
{
    const url = process.env.AUTHWALL_DB ?? `sqlite://${path.join(os.tmpdir(), 'authwall-e2e.sqlite3')}`;
    const vars = url.startsWith('sqlite://')
        ? {client: 'better-sqlite3', connection: {filename: url.slice('sqlite://'.length)}, useNullAsDefault: true}
        : {client: url.startsWith('mysql://') ? 'mysql2' : 'pg', connection: url};
    const db = knex(vars);
    db[Symbol.asyncDispose] = function () {
        return db.destroy();
    };
    return db;
}
