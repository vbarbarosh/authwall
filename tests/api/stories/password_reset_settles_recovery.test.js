const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const db = require('../../../db');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('A completed reset settles the recovery | stories', function () {

    beforeEach(function () {
        config.flows.password.min_password_length = 4;
    });

    async function request_reset_token(ctx, email)
    {
        const before = ctx.sent_emails.length;
        await ctx.http_post_json('/auth/password-reset/request', {email});
        const sent = ctx.sent_emails.slice(before).find(v => v.name === const_email.password_reset);
        assert.ok(sent, 'a reset email should be sent');
        return sent.placeholders.token;
    }

    async function confirm_reset(ctx, token, password)
    {
        await ctx.http_post_json('/auth/password-reset/confirm', {token, password, password_confirm: password});
        return (await ctx.http_get_json('/auth/status')).error;
    }

    it('kills the sibling link when one of two links completes the reset', async function () {
        await this.add_user({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        const first = await request_reset_token(this, 'mocha@authwall.test');
        const second = await request_reset_token(this, 'mocha@authwall.test');

        assert.strictEqual(await confirm_reset(this, second, 'pass456'), null);
        assert.strictEqual(await confirm_reset(this, first, 'hacked'), 'Invalid reset token');

        // Both the used one and the sibling are gone from play.
        assert.strictEqual((await db('password_reset_tokens').whereNull('used_at')).length, 0);
        await this.assert_password({username: 'mocha', password: 'pass456'});
    });

    it('kills the link issued to an address the account has since changed', async function () {
        await this.sign_in({username: 'mocha', email: 'old@authwall.test', password: 'pass123'});
        const token = await request_reset_token(this, 'old@authwall.test');

        await this.http_post_json(config.pages.email_change_request, {email: 'new@authwall.test'});
        const change = this.sent_emails.find(v => v.placeholders?.token && v.to === 'new@authwall.test');
        await this.http_get_json(urlmod(config.pages.email_change_confirm, {token: change.placeholders.token}));

        assert.strictEqual(await confirm_reset(this, token, 'hacked'), 'Invalid reset token');
        await this.assert_password({username: 'mocha', password: 'pass123'});
    });

    it('kills the link issued to an address the account has since removed', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        const token = await request_reset_token(this, 'mocha@authwall.test');

        await this.http_post_json('/auth/email/remove');
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {error: null, authenticated: true});

        assert.strictEqual(await confirm_reset(this, token, 'hacked'), 'Invalid reset token');
        await this.assert_password({username: 'mocha', password: 'pass123'});
    });
});
