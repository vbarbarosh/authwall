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
