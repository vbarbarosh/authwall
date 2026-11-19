const bcrypt = require('bcrypt');
const open_e2e_db = require('./open_e2e_db');
const sign_up_with_primary = require('./sign_up_with_primary');
const {test, expect} = require('@playwright/test');

// The profile's password form follows the account: change it, set a first
// one, or say what it needs (M-13).
test.describe('the profile password form', function () {

    test('an account with a password changes it, giving the current one', async function ({page}) {
        await sign_up_with_primary(page);

        await page.goto('/auth/profile');
        await expect(page.getByTestId('profile-password-title')).toHaveText('Change password');
        await expect(page.getByTestId('profile-current-password')).toBeVisible();
        await expect(page.getByTestId('profile-password-submit')).toHaveText('Update password');
        await expect(page.getByTestId('profile-password-needs')).toBeHidden();
    });

    test('an account with no password sets a first one, asked no current one', async function ({page}) {
        const {user_id} = await sign_up_with_primary(page);
        await using db = open_e2e_db();
        await db('users').where({id: user_id}).update({password_hash: null});

        await page.goto('/auth/profile');
        await expect(page.getByTestId('profile-password-title')).toHaveText('Set a password');
        await expect(page.getByTestId('profile-current-password')).toBeHidden();
        await expect(page.getByTestId('profile-password-submit')).toHaveText('Set password');

        await page.getByTestId('profile-new-password').fill('first-pass-123');
        await page.getByTestId('profile-new-password-confirm').fill('first-pass-123');
        await page.getByTestId('profile-password-submit').click();
        await expect(page.getByTestId('confirm-reason')).toHaveText('Setting a first password needs the owner. Confirm it is you, then set it again.');

        // The e2e mailer delivers nothing: the mailed code is set to one the test knows.
        await db('confirm_codes').where({user_id}).update({code_hash: bcrypt.hashSync('246810', 4)});
        const digits = page.getByTestId('confirm-code').locator('.otp-input');
        for (let i = 0; i < 6; i++) {
            await digits.nth(i).fill('246810'[i]);
        }
        await page.getByTestId('confirm-code-submit').click();
        await page.waitForURL(v => v.pathname === '/auth/profile');

        await page.getByTestId('profile-new-password').fill('first-pass-123');
        await page.getByTestId('profile-new-password-confirm').fill('first-pass-123');
        await page.getByTestId('profile-password-submit').click();
        await expect(page.getByTestId('profile-password-ok')).toHaveText('Password set.');
        await expect(page.getByTestId('profile-password-title')).toHaveText('Change password');
        await expect(page.getByTestId('profile-current-password')).toBeVisible();
        await expect(page.getByTestId('profile-password-submit')).toHaveText('Update password');
        expect((await db('users').where({id: user_id}).first()).password_hash).toMatch(/^\$2/);
    });

    test('an account with no confirmed address is told what a password needs', async function ({page}) {
        // No password, no username, and an address never confirmed.
        const {user_id} = await sign_up_with_primary(page, {primary: false});
        await using db = open_e2e_db();
        await db('user_identities').where({user_id, type: 'username'}).del();
        await db('users').where({id: user_id}).update({password_hash: null});

        await page.goto('/auth/profile');
        await expect(page.getByTestId('profile-password-title')).toHaveText('Set a password');
        await expect(page.getByTestId('profile-password-needs')).toHaveText('A password needs a confirmed email address first.');
        await expect(page.getByTestId('profile-new-password')).toBeHidden();
        await expect(page.getByTestId('profile-password-submit')).toBeHidden();
    });

});
