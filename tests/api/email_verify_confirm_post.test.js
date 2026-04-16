const assert = require('assert');
const config = require('../../config');
const db = require('../../db');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('GET /auth/email-verify/confirm', function () {

    it('verifies email with valid token', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});

        const status = await this.client.get_json('/auth/status');
        const provider = status.providers.find(v => v.type === 'email');
        assert.strictEqual(provider.verified_at, null);

        await this.client.post_json('/auth/email-verify/request', {_csrf: status.csrf_token});
        await this.wait_for_emails(2);
        const {link} = this.sent_emails.find(e => e.placeholders?.link).placeholders;
        const token = new URL(link).searchParams.get('token');

        await this.client.get_json(urlmod(config.pages.email_verify_confirm, {token}));

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.ok(status2.providers.find(v => v.type === 'email').verified_at !== null);
    });

    it('fails with missing token', async function () {
        await this.client.get_json(config.pages.email_verify_confirm);
        const status = await this.client.get_json('/auth/status');
        assert.strictEqual(status.error, 'Missing token');
    });

    it('fails with invalid token', async function () {
        await this.client.get_json(urlmod(config.pages.email_verify_confirm, {token: 'invalid-token'}));
        const status = await this.client.get_json('/auth/status');
        assert.strictEqual(status.error, 'Invalid or expired verification link');
    });

    it('fails with expired token', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/email-verify/request', {_csrf: status.csrf_token});
        await this.wait_for_emails(2);
        const {link} = this.sent_emails.find(e => e.placeholders?.link).placeholders;
        const token = new URL(link).searchParams.get('token');

        await db('email_verify_tokens').update({expires_at: new Date(Date.now() - 1000)});
        await this.client.get_json(urlmod(config.pages.email_verify_confirm, {token}));

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid or expired verification link');
    });

    it('fails with already used token', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/email-verify/request', {_csrf: status.csrf_token});
        await this.wait_for_emails(2);
        const {link} = this.sent_emails.find(e => e.placeholders?.link).placeholders;
        const token = new URL(link).searchParams.get('token');

        await this.client.get_json(urlmod(config.pages.email_verify_confirm, {token}));
        await this.client.get_json(urlmod(config.pages.email_verify_confirm, {token}));

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid or expired verification link');
    });

});
