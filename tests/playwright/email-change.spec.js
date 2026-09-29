const crypto = require('crypto');
const open_e2e_db = require('./open_e2e_db');
const sign_up_with_primary = require('./sign_up_with_primary');
const {test, expect} = require('@playwright/test');

// Changing the email from the profile (AW-33): the current primary approves
// first, then the new address gets its link (primary_change_needs_both_addresses).
test.describe('email change', function () {

    test('asks the current primary to approve the change', async function ({page}) {
        const {email, user_id} = await sign_up_with_primary(page);

        await page.goto('/auth/profile');
        await page.getByTestId('email-change-open').click();
        await expect(page.getByTestId('email-change-how')).toHaveText(`Your current address, ${email}, approves the change first; then we send a confirmation link to the new one.`);

        await page.getByTestId('email-change-email').fill(`new-${email}`);
        await page.getByTestId('email-change-submit').click();
        await expect(page.getByTestId('email-change-approve-sent-view')).toBeVisible();
        expect(new URL(page.url()).pathname).toBe('/auth/email-change/approve/sent');

        await using db = open_e2e_db();
        const rows = await db('email_change_tokens').where({user_id}).select('email', 'approved_at');
        expect(rows).toEqual([{email: `new-${email}`, approved_at: null}]);
    });

    test('the approval link sends the new address its link', async function ({page}) {
        const {email, user_id} = await sign_up_with_primary(page);
        // The approval link's token is stored hashed; the test inserts one it knows.
        const token = crypto.randomBytes(16).toString('hex');
        const now = new Date();
        await using db = open_e2e_db();
        await db('email_change_tokens').insert({
            user_id,
            email: `new-${email}`,
            email_normalized: `new-${email}`,
            token_hash: crypto.createHash('sha256').update(crypto.randomBytes(16)).digest('base64url'),
            approve_token_hash: crypto.createHash('sha256').update(token).digest('base64url'),
            created_at: now,
            updated_at: now,
            expires_at: new Date(Date.now() + 30*60*1000),
        });

        await page.goto(`/auth/email-change/approve?token=${token}`);
        await expect(page.locator('[data-view="email-change-sent"]')).toContainText('We\'ve sent a confirmation link to the new address.');
        const row = await db('email_change_tokens').where({user_id}).first();
        expect(row.approved_at).not.toBeNull();
    });

    test('an account without a primary confirms it is you, then returns to the form', async function ({page}) {
        const {email} = await sign_up_with_primary(page, {primary: false});

        await page.goto('/auth/profile');
        await page.getByTestId('email-change-open').click();
        await page.getByTestId('email-change-email').fill(`new-${email}`);
        await page.getByTestId('email-change-submit').click();

        await expect(page.getByTestId('confirm-reason')).toHaveText('Your account has no verified primary address to approve an email change. Confirm it is you to continue.');
        await page.getByTestId('confirm-password').fill('pass1234');
        await page.getByTestId('confirm-password-submit').click();
        await page.waitForURL(v => v.pathname === '/auth/email-change/request');

        await page.getByTestId('email-change-email').fill(`new-${email}`);
        await page.getByTestId('email-change-submit').click();
        await expect(page.locator('[data-view="email-change-sent"]')).toBeVisible();
    });

});
