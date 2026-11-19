const assert = require('assert');
const config = require('../../../config');
const db = require('../../../db');

// See code_guessing_budget.md.
describe('Wrong codes have a budget per address and per IP | stories', function () {

    const MINUTE = 60*1000;

    // Moves every code of the table back in time: past the resend cooldown,
    // or past the hour the budget counts.
    async function age_codes(table, minutes) {
        await db(table).update({created_at: new Date(Date.now() - minutes*MINUTE)});
    }

    // Moves every wrong guess back in time, past the hour the budget counts.
    async function age_guesses(minutes) {
        await db('auth_events').update({created_at: new Date(Date.now() - minutes*MINUTE)});
    }

    async function guess_magic_code(ctx, code) {
        await ctx.http_post_json('/auth/magic-link/confirm', {email: 'nobody@corp.test', code});
        return (await ctx.http_get_json('/auth/status')).error;
    }

    it('an address gets 10 wrong sign-in codes per hour, across codes and browsers', async function () {
        for (let i = 0; i < 2; i++) {
            this.client.cookies = new Map();
            await this.http_post_json('/auth/magic-link/request', {email: 'nobody@corp.test'});
            for (let j = 0; j < 5; j++) {
                assert.strictEqual(await guess_magic_code(this, '000000'), 'Invalid or expired code');
            }
            await age_codes('magic_links', 2);
        }

        this.client.cookies = new Map();
        await this.http_post_json('/auth/magic-link/request', {email: 'nobody@corp.test'});
        assert.strictEqual(await guess_magic_code(this, this.sent_emails.at(-1).placeholders.code), 'Too many attempts. Try again later.');

        // An hour on, the address has its budget back.
        await age_codes('magic_links', 61);
        await age_guesses(61);
        this.client.cookies = new Map();
        await this.http_post_json('/auth/magic-link/request', {email: 'nobody@corp.test'});
        await guess_magic_code(this, this.sent_emails.at(-1).placeholders.code);
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);
    });

    it('an address gets 10 wrong verification codes per hour, across codes', async function () {
        await this.sign_in({email: 'nobody@corp.test', password: 'pass123', verified: false});
        for (let i = 0; i < 2; i++) {
            await this.http_post_json('/auth/email-verify/request');
            for (let j = 0; j < 5; j++) {
                await this.http_post_json('/auth/email-verify/confirm', {code: '000000'});
            }
            assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Invalid or expired verification code');
            await age_codes('email_verify_tokens', 2);
        }

        await this.http_post_json('/auth/email-verify/request');
        await this.http_post_json('/auth/email-verify/confirm', {code: this.sent_emails.at(-1).placeholders.code});
        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Too many attempts. Try again later.');
    });

    // AW-124: the guessing account cannot take its guesses back; they are
    // counted from its failure events, not from its codes.
    describe('what the guesser does to its own codes', function () {

        async function guess_verify_code(ctx, code) {
            await ctx.http_post_json('/auth/email-verify/confirm', {code});
            return (await ctx.http_get_json('/auth/status')).error;
        }

        // The newest verification code mailed to the address.
        function last_code(ctx) {
            return ctx.sent_emails.findLast(v => v.placeholders?.code && v.placeholders?.link).placeholders.code;
        }

        // Ten wrong codes: five, a new code past the resend cooldown, five more.
        async function spend_the_budget(ctx) {
            for (let i = 0; i < 2; i++) {
                if (i) {
                    await age_codes('email_verify_tokens', 2);
                    await ctx.http_post_json('/auth/email-verify/request');
                }
                for (let j = 0; j < 5; j++) {
                    assert.strictEqual(await guess_verify_code(ctx, '000000'), 'Invalid or expired verification code');
                }
            }
        }

        it('removing the address and adding it again, held at the verify step, brings no new guesses', async function () {
            config.confirm_email.required = true;
            await this.http_post_json('/auth/sign-up', {username: 'mallory', email: 'nobody@corp.test', password: 'mallory-pass', password_confirm: 'mallory-pass'});
            await spend_the_budget(this);

            await this.http_post_json('/auth/email/remove');
            await age_codes('email_verify_tokens', 2);
            await this.http_post_json('/auth/email/add', {email: 'nobody@corp.test'});
            assert.strictEqual(await guess_verify_code(this, last_code(this)), 'Too many attempts. Try again later.');
        });

        async function sign_up(ctx) {
            await ctx.http_post_json('/auth/sign-up', {email: 'nobody@corp.test', password: 'mallory-pass', password_confirm: 'mallory-pass'});
        }

        async function remove_the_account(ctx) {
            await ctx.http_post_json('/auth/account/remove', {confirmation: 'DELETE'});
            await ctx.confirm({password: 'mallory-pass'});
            await ctx.http_post_json('/auth/account/remove', {confirmation: 'DELETE'});
            assert.strictEqual((await db('users')).length, 0);
        }

        it('removing the account and signing up again brings none, and the sign-up waits out the resend cooldown', async function () {
            await sign_up(this);
            await spend_the_budget(this);
            await remove_the_account(this);

            await sign_up(this);
            assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Verification email already sent. Please wait.');
            assert.strictEqual((await db('users')).length, 0);

            await age_guesses(2);
            await sign_up(this);
            assert.strictEqual(await guess_verify_code(this, last_code(this)), 'Too many attempts. Try again later.');
        });

        it('an address released as stale, and signed up for again, brings none', async function () {
            config.confirm_email.required = true;
            config.access.allowed_domains = ['corp.test'];
            await this.http_post_json('/auth/sign-up', {email: 'nobody@corp.test', password: 'mallory-pass', password_confirm: 'mallory-pass'});
            await spend_the_budget(this);

            // 16 minutes on: the codes expired and the pending address is stale.
            const before = new Date(Date.now() - 16*MINUTE);
            await db('email_verify_tokens').update({created_at: before, expires_at: before});
            await db('user_identities').update({created_at: before});
            await age_guesses(16);
            await this.http_post_json('/auth/sign-out');
            await this.http_post_json('/auth/sign-up', {email: 'nobody@corp.test', password: 'mallory-pass', password_confirm: 'mallory-pass'});
            assert.strictEqual((await db('users')).length, 2);
            assert.strictEqual(await guess_verify_code(this, last_code(this)), 'Too many attempts. Try again later.');
        });

    });

    describe('with rate limiting on', function () {

        // The per-IP counter is built with the app, which reads the setting.
        beforeEach(function () {
            config.rate_limiting.enabled = true;
        });

        it('an IP gets 20 wrong codes per 15 minutes, across addresses', async function () {
            for (let i = 0; i < 20; i++) {
                await this.http_post_json('/auth/magic-link/confirm', {email: `guess-${i}@corp.test`, code: '000000'});
            }

            await this.http_post_json('/auth/magic-link/request', {email: 'fresh@corp.test'});
            await this.http_post_json('/auth/magic-link/confirm', {email: 'fresh@corp.test', code: this.sent_emails.at(-1).placeholders.code});
            assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
                error: 'Too many attempts. Try again later.',
                authenticated: false,
            });
        });

    });

});
