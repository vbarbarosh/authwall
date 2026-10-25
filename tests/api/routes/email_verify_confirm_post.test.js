const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const date_trunc_ms = require('../../../src/helpers/date/date_trunc_ms');
const db = require('../../../db');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('POST /auth/email-verify/confirm/open', function () {

    it('verifies email with valid token', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});

        const status = await this.http_get_json('/auth/status');
        const provider = status.providers.find(v => v.type === 'email');
        assert.strictEqual(provider.verified_at, null);

        await this.http_post_json('/auth/email-verify/request');
        await this.wait_for_emails(1);
        const {link} = this.sent_emails.find(e => e.placeholders?.link).placeholders;
        const token = new URL(link).searchParams.get('token');

        await this.open_link(urlmod(config.pages.email_verify_confirm, {token}));

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.ok(status2.providers.find(v => v.type === 'email').verified_at !== null);
    });

    it('refreshes email verification fields in the current session', async function () {
        config.confirm_email.required = true;

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        const session = await this.client.get_session();
        assert.strictEqual(session.email, 'mocha@authwall.test');
        assert.strictEqual(session.email_verified_at, null);

        await this.http_post_json('/auth/email-verify/request');
        await this.wait_for_emails(1);
        const {link} = this.sent_emails.find(e => e.placeholders?.link).placeholders;
        const token = new URL(link).searchParams.get('token');

        await this.open_link(urlmod(config.pages.email_verify_confirm, {token}));

        const session2 = await this.client.get_session();
        assert.strictEqual(session2.email, 'mocha@authwall.test');
        assert.match(session2.email_verified_at, /^\d{4}-\d{2}-\d{2}T/);
    });

    it('fails with missing token', async function () {
        await this.open_link(config.pages.email_verify_confirm);
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Missing token',
        });
    });

    it('fails with invalid token', async function () {
        await this.open_link(urlmod(config.pages.email_verify_confirm, {token: 'invalid-token'}));
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid or expired verification link',
        });
    });

    it('fails with expired token', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/email-verify/request');
        await this.wait_for_emails(1);
        const {link} = this.sent_emails.find(e => e.placeholders?.link).placeholders;
        const token = new URL(link).searchParams.get('token');

        await db('email_verify_tokens').update({expires_at: date_trunc_ms()});
        await this.open_link(urlmod(config.pages.email_verify_confirm, {token}));

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid or expired verification link',
        });
    });

    it('fails with already used token', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/email-verify/request');
        await this.wait_for_emails(1);

        const {link} = this.sent_emails.find(e => e.placeholders?.link).placeholders;
        const token = new URL(link).searchParams.get('token');

        await this.open_link(urlmod(config.pages.email_verify_confirm, {token}));
        await this.open_link(urlmod(config.pages.email_verify_confirm, {token}));

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid or expired verification link',
        });
    });

});

describe('GET /auth/email-verify/confirm/open', function () {

    async function request_link(ctx) {
        await ctx.http_post_json('/auth/email-verify/request');
        await ctx.wait_for_emails(1);
        const {link} = ctx.sent_emails.find(v => v.placeholders?.link).placeholders;
        return urlmod(`${config.pages.email_verify_confirm}/open`, {token: new URL(link).searchParams.get('token')});
    }

    it('names the address and changes nothing', async function () {
        await this.sign_in({email: 'Mocha@authwall.test', password: 'pass123', verified: false});
        const url = await request_link(this);

        assert.deepStrictEqual(await this.http_get_json(url), {error: null, email: 'Mocha@authwall.test', handover: false});
        assert.strictEqual((await db('user_identities').where({type: const_user_identity.email}).first()).verified_at, null);
        assert.strictEqual((await db('email_verify_tokens').first()).used_at, null);
    });

    it('says the account would change hands when opened elsewhere and its only way in is the password', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        const url = await request_link(this);

        this.client.cookies.clear();
        assert.deepStrictEqual(await this.http_get_json(url), {error: null, email: 'mocha@authwall.test', handover: true});
        await this.assert_password({email: 'mocha@authwall.test', password: 'pass123'});
        assert.strictEqual((await db('password_reset_tokens')).length, 0);
    });

    it('asks to sign in when opened elsewhere and the account has another way in', async function () {
        const {user_id} = await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        const now = new Date();
        await db('user_identities').insert({uid: random_uid_user_identity(), user_id, type: const_user_identity.oauth_github, value: '777', value_normalized: '777', created_at: now, updated_at: now, verified_at: now});
        const url = await request_link(this);

        this.client.cookies.clear();
        assert.deepStrictEqual(await this.http_get_json(url), {error: 'Sign in to confirm this address', email: 'mocha@authwall.test', sign_in: true, not_mine: true});
    });

    it('gives the reason the link would fail', async function () {
        assert.deepStrictEqual(await this.http_get_json(`${config.pages.email_verify_confirm}/open`), {error: 'Missing token', email: null});
        assert.deepStrictEqual(await this.http_get_json(urlmod(`${config.pages.email_verify_confirm}/open`, {token: 'invalid-token'})), {error: 'Invalid or expired verification link', email: null});
    });

});

describe('POST /auth/email-verify/confirm', function () {

    it('verifies email with valid code', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/email-verify/request');
        await this.wait_for_emails(1);

        await this.http_post_json('/auth/email-verify/confirm', {
            code: this.sent_emails[0].placeholders.code,
        });

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, null);
        assert.ok(status.providers.find(v => v.type === 'email').verified_at !== null);
    });

    it('fails with wrong code', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/email-verify/request');

        await this.http_post_json('/auth/email-verify/confirm', {code: '000000'});

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid or expired verification code',
        });
    });

});
