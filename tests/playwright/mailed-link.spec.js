const crypto = require('crypto');
const open_e2e_db = require('./open_e2e_db');
const sign_up_with_primary = require('./sign_up_with_primary');
const {test, expect} = require('@playwright/test');

// A mailed link opens a page that names the address and changes nothing; only
// its button acts (AW-78, AW-11; mailed_links_opened_by_a_scanner). The tokens
// are stored hashed and the e2e mailer delivers nothing, so each test inserts
// a row with a token it knows.
test.describe('mailed link', function () {

    function token_pair() {
        const token = crypto.randomBytes(16).toString('hex');
        return {token, token_hash: crypto.createHash('sha256').update(token).digest('base64url')};
    }

    async function insert_magic_link(db, email) {
        const {token, token_hash} = token_pair();
        const now = new Date();
        await db('magic_links').insert({email, email_normalized: email, token_hash, created_at: now, updated_at: now, expires_at: new Date(Date.now() + 10*60*1000)});
        return token;
    }

    async function insert_approval(db, user_id, email) {
        const {token, token_hash} = token_pair();
        const now = new Date();
        await db('email_change_tokens').insert({
            user_id,
            email,
            email_normalized: email,
            token_hash: crypto.createHash('sha256').update(crypto.randomBytes(16)).digest('base64url'),
            approve_token_hash: token_hash,
            created_at: now,
            updated_at: now,
            expires_at: new Date(Date.now() + 30*60*1000),
        });
        return token;
    }

    test('the sign-in link names the address, and signs in only on its button', async function ({page}) {
        const email = `ml${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@authwall.test`;
        await using db = open_e2e_db();
        const token = await insert_magic_link(db, email);

        await page.goto(`/auth/magic-link/confirm?token=${token}`);
        await expect(page.getByTestId('link-title')).toHaveText('Sign in');
        await expect(page.getByTestId('link-text')).toHaveText(`Sign in to your account as ${email}.`);
        await expect(page.getByTestId('link-submit')).toBeEnabled();
        expect((await db('magic_links').where({email_normalized: email}).first()).used_at).toBeNull();
        expect((await (await page.request.get('/auth/status')).json()).authenticated).toBe(false);

        await page.getByTestId('link-submit').click();
        await page.waitForURL(v => !v.pathname.startsWith('/auth/magic-link'));
        expect((await (await page.request.get('/auth/status')).json()).authenticated).toBe(true);
    });

    test('a dead link says why and keeps its button disabled', async function ({page}) {
        await page.goto('/auth/email-change/confirm?token=no-such-token');
        await expect(page.getByTestId('link-title')).toHaveText('Confirm your new address');
        await expect(page.getByTestId('link-error')).toHaveText('Invalid or expired email change link');
        await expect(page.getByTestId('link-submit')).toBeDisabled();
        await expect(page.getByTestId('link-text')).toHaveText('');
    });

    test('a link spent between the page and the button says why', async function ({page}) {
        const email = `ml${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@authwall.test`;
        await using db = open_e2e_db();
        const token = await insert_magic_link(db, email);

        await page.goto(`/auth/magic-link/confirm?token=${token}`);
        await expect(page.getByTestId('link-submit')).toBeEnabled();
        await db('magic_links').where({email_normalized: email}).update({used_at: new Date()});

        await page.getByTestId('link-submit').click();
        await expect(page.getByTestId('link-error')).toHaveText('Invalid or expired magic link');
        await expect(page.getByTestId('link-view')).toBeVisible();
        await expect(page.getByTestId('link-submit')).toBeEnabled();
    });

    test('a confirmation link opened in another browser asks to sign in, then confirms', async function ({page}) {
        const {username, user_id} = await sign_up_with_primary(page);
        const added = `added-${username}@authwall.test`;
        const {token, token_hash} = token_pair();
        const now = new Date();
        await using db = open_e2e_db();
        await db('user_identities').insert([
            {uid: crypto.randomBytes(12).toString('hex'), user_id, type: 'oauth_github', value: username, value_normalized: username, created_at: now, updated_at: now, verified_at: now},
            {uid: crypto.randomBytes(12).toString('hex'), user_id, type: 'email', value: added, value_normalized: added, created_at: now, updated_at: now},
        ]);
        await db('email_verify_tokens').insert({user_id, email_normalized: added, token_hash, created_at: now, updated_at: now, expires_at: new Date(Date.now() + 30*60*1000)});

        await page.context().clearCookies();
        await page.goto(`/auth/email-verify/confirm?token=${token}`);
        await expect(page.getByTestId('link-error')).toHaveText('Sign in to confirm this address');
        await expect(page.getByTestId('link-submit')).toHaveText('Sign in to confirm');
        await page.getByTestId('link-submit').click();

        await expect(page.getByTestId('signin-view')).toBeVisible();
        await expect(page.getByTestId('signin-csrf')).toHaveValue(/.+/);
        await page.getByTestId('signin-username').fill(username);
        await page.getByTestId('signin-password').fill('pass1234');
        await page.getByTestId('signin-submit').click();
        await page.waitForURL(v => v.pathname === '/auth/email-verify/confirm');
        await expect(page.getByTestId('link-submit')).toHaveText('Confirm email');
        expect((await db('user_identities').where({type: 'email', value_normalized: added}).first()).verified_at).toBeNull();

        await page.getByTestId('link-submit').click();
        await page.waitForURL(v => v.pathname === '/auth/email-verify/success');
        expect((await db('user_identities').where({type: 'email', value_normalized: added}).first()).verified_at).not.toBeNull();
    });

    test('a confirmation link opened in another browser says the account would change hands, and hands it over only on its button', async function ({page}) {
        const {username, email, user_id} = await sign_up_with_primary(page, {primary: false});
        const {token, token_hash} = token_pair();
        const now = new Date();
        await using db = open_e2e_db();
        await db('email_verify_tokens').insert({user_id, email_normalized: email, token_hash, created_at: now, updated_at: now, expires_at: new Date(Date.now() + 30*60*1000)});

        await page.context().clearCookies();
        await page.goto(`/auth/email-verify/confirm?token=${token}`);
        await expect(page.getByTestId('link-text')).toHaveText(`This account was signed up in another browser. Confirming ${email} here makes it yours: its password stops working, every browser signed in to it is signed out, and you set a new password next. If you signed up yourself, open this link in that browser instead.`);
        await expect(page.getByTestId('link-submit')).toHaveText('Confirm and set a password');
        expect((await db('users').where({id: user_id}).first()).password_hash).not.toBeNull();

        await page.getByTestId('link-submit').click();
        await page.waitForURL(v => v.pathname === '/auth/password-reset/confirm');
        expect((await db('users').where({id: user_id}).first()).password_hash).toBeNull();
        await page.locator('#rc-pass').fill('new-pass-1234');
        await page.locator('#rc-pass2').fill('new-pass-1234');
        await page.locator('#rc-submit').click();
        await page.waitForURL(v => v.pathname === '/auth/sign-in');

        // A fresh load: the sign-in form keeps the CSRF token of its first load
        // (AW-31), and the reset changed it.
        await page.goto('/auth/sign-in');
        await expect(page.getByTestId('signin-csrf')).toHaveValue(/.+/);
        await page.getByTestId('signin-username').fill(username);
        await page.getByTestId('signin-password').fill('new-pass-1234');
        await page.getByTestId('signin-submit').click();
        await page.waitForURL(v => v.pathname !== '/auth/sign-in');
        expect((await (await page.request.get('/auth/status')).json()).authenticated).toBe(true);
    });

    test('a very long address wraps inside the card, above the button', async function ({page}) {
        const {user_id} = await sign_up_with_primary(page);
        const email = `${'a'.repeat(64)}@${'b'.repeat(60)}.${'c'.repeat(60)}.authwall.test`;
        await using db = open_e2e_db();
        const token = await insert_approval(db, user_id, email);

        await page.setViewportSize({width: 360, height: 740});
        await page.goto(`/auth/email-change/approve?token=${token}`);
        await expect(page.getByTestId('link-text')).toContainText(email);

        const card = await page.getByTestId('link-view').locator('.card').boundingBox();
        const text = await page.getByTestId('link-text').boundingBox();
        const button = await page.getByTestId('link-submit').boundingBox();
        expect(text.x).toBeGreaterThanOrEqual(card.x);
        expect(text.x + text.width).toBeLessThanOrEqual(card.x + card.width);
        expect(text.y + text.height).toBeLessThanOrEqual(button.y);
        expect(button.x + button.width).toBeLessThanOrEqual(card.x + card.width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });

});
