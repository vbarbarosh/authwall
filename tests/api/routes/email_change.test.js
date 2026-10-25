const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const db = require('../../../db');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('POST /auth/email-change/confirm/open', function () {

    it('replaces the old email identity with the new one', async function () {
        const email = 'old@authwall.test';
        const new_email = 'new@authwall.test';
        const password = 'pass123';

        await this.add_user({email, password});

        await this.http_post_json('/auth/sign-in', {username: email, password});
        await this.http_post_json('/auth/email-change/request', {email: new_email});
        await this.approve_email_change();

        await this.open_link(this.sent_emails.find(v => v.to === new_email).placeholders.confirm_link);

        const status = await this.http_get_json('/auth/status');
        const actual = status.providers.filter(v => v.type === 'email').map(v => v.value_normalized);

        assert.deepStrictEqual(actual, [new_email]);
    });

    it('rejects a new email outside the configured allowed domains', async function () {
        config.access.allowed_domains = ['authwall.test'];

        const email = 'old@authwall.test';
        const new_email = 'new@example.test';
        const password = 'pass123';

        await this.sign_in({email, password});
        await this.http_post_json('/auth/email-change/request', {email: new_email});

        const status = await this.http_get_json('/auth/status');
        const actual = status.providers.filter(v => v.type === 'email').map(v => v.value_normalized);
        const tokens = await db('email_change_tokens').where({email_normalized: new_email});

        assert.strictEqual(status.error, 'Email domain is not allowed');
        assert.deepStrictEqual(actual, [email]);
        assert.deepStrictEqual(tokens, []);
        assert.deepStrictEqual(this.sent_emails, []);
    });

    it('fails when the user has no email identity to change', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});

        await this.http_post_json('/auth/email-change/request', {email: 'new@authwall.test'});

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'No email found');
        assert.strictEqual(status.providers.find(v => v.type === 'email'), undefined);
        assert.deepStrictEqual(this.sent_emails, []);
    });

});

describe('GET /auth/email-change/approve/open and /auth/email-change/confirm/open', function () {

    function link_token(ctx, name) {
        return ctx.sent_emails.findLast(v => v.name === name).placeholders.token;
    }

    it('the approval page names the new address and changes nothing', async function () {
        await this.sign_in({email: 'old@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/email-change/request', {email: 'New@authwall.test'});
        const token = link_token(this, const_email.email_change_approve);

        this.client.cookies.clear();
        assert.deepStrictEqual(await this.http_get_json(urlmod(`${config.pages.email_change_approve}/open`, {token})), {
            error: null,
            email: 'New@authwall.test',
        });
        assert.strictEqual((await db('email_change_tokens').first()).approved_at, null);
        assert.deepStrictEqual(this.sent_emails.map(v => v.name), [const_email.email_change_approve]);
    });

    it('the confirmation page names the new address and changes nothing', async function () {
        await this.sign_in({email: 'old@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/email-change/request', {email: 'new@authwall.test'});
        await this.approve_email_change();
        const token = link_token(this, const_email.email_change_requested);

        assert.deepStrictEqual(await this.http_get_json(urlmod(`${config.pages.email_change_confirm}/open`, {token})), {
            error: null,
            email: 'new@authwall.test',
        });
        assert.deepStrictEqual(await db('user_identities').where({type: 'email'}).pluck('value_normalized'), ['old@authwall.test']);
        assert.strictEqual((await db('email_change_tokens').first()).used_at, null);
    });

    it('gives the reason each link would fail', async function () {
        assert.deepStrictEqual(await this.http_get_json(`${config.pages.email_change_approve}/open`), {error: 'Missing token', email: null});
        assert.deepStrictEqual(await this.http_get_json(urlmod(`${config.pages.email_change_approve}/open`, {token: 'invalid'})), {error: 'Invalid or expired approval link', email: null});
        assert.deepStrictEqual(await this.http_get_json(urlmod(`${config.pages.email_change_confirm}/open`, {token: 'invalid'})), {error: 'Invalid or expired email change link', email: null});
    });

});
