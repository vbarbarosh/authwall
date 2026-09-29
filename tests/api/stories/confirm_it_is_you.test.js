const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');

// See confirm_it_is_you.md.
describe('Confirm it is you | stories', function () {

    beforeEach(function () {
        config.flows.password.min_password_length = 4;
    });

    async function request_code(ctx) {
        await ctx.http_post_json('/auth/confirm/request');
        await ctx.wait_for_emails(1);
        const sent = ctx.sent_emails.find(v => v.name === const_email.confirm_code);
        assert.ok(sent, (await ctx.http_get_json('/auth/status')).error ?? 'no code was mailed');
        return sent;
    }

    async function confirm(ctx, fields) {
        await ctx.http_post_json('/auth/confirm', fields);
        const status = await ctx.http_get_json('/auth/status');
        const session = await ctx.client.get_session();
        return {error: status.error, confirmed_at: session.confirmed_at ?? null};
    }

    it('confirms with a code mailed to the primary address', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        const sent = await request_code(this);
        assert.strictEqual(sent.to, 'mocha@authwall.test');

        const r = await confirm(this, {code: sent.placeholders.code});
        assert.strictEqual(r.error, null);
        assert.ok(r.confirmed_at);
    });

    it('confirms with the password', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        const r = await confirm(this, {password: 'pass123'});
        assert.strictEqual(r.error, null);
        assert.ok(r.confirmed_at);
    });

    it('refuses a wrong password and a wrong code', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        assert.deepStrictEqual(await confirm(this, {password: 'wrong'}), {error: 'Password is incorrect', confirmed_at: null});
        await request_code(this);
        assert.deepStrictEqual(await confirm(this, {code: '000000'}), {error: 'Invalid or expired code', confirmed_at: null});
    });

    it('refuses even the right answer after five failures', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        await request_code(this);
        for (const fields of [{code: '000000'}, {password: 'wrong'}, {code: '000000'}, {password: 'wrong'}, {code: '000000'}]) {
            await confirm(this, fields);
        }
        assert.deepStrictEqual(await confirm(this, {password: 'pass123'}), {error: 'Too many attempts. Try again later.', confirmed_at: null});
    });

    it('asks an account with no primary address for its password', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/confirm/request');
        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Your account has no primary address. Confirm with your password.');
        assert.strictEqual(this.sent_emails.length, 0);

        assert.strictEqual((await confirm(this, {password: 'pass123'})).error, null);
    });

    it('asks an account with no password for a code', async function () {
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: this.sent_emails[0].placeholders.code});
        const r = await confirm(this, {password: 'anything'});
        assert.strictEqual(r.error, 'Your account has no password. Confirm with a code sent to your primary address.');
        assert.strictEqual(r.confirmed_at, null);
    });

    it('starts a new sign-in unconfirmed', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        assert.ok((await confirm(this, {password: 'pass123'})).confirmed_at);

        await this.http_post_json('/auth/sign-out');
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});
        const session = await this.client.get_session();
        assert.ok(session.user_uid);
        assert.strictEqual(session.confirmed_at, undefined);
    });

});
