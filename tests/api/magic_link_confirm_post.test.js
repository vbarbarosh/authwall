const assert = require('assert');
const date_trunc_ms = require('../../src/helpers/date/date_trunc_ms');
const db = require('../../db');

describe('POST /auth/magic-link/confirm', function () {

    it('signs in existing user with code', async function () {
        const user = await this.add_user({email: 'mocha@authwall.test'});
        await this.http_post_json('/auth/magic-link/request', {email: user.email});

        const {code} = this.sent_emails[0].placeholders;
        await this.http_post_json('/auth/magic-link/confirm', {email: user.email, code});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

    it('signs up new user with code', async function () {
        await this.http_post_json('/auth/magic-link/request', {email: 'new-user@authwall.test'});

        const {code} = this.sent_emails[0].placeholders;
        await this.http_post_json('/auth/magic-link/confirm', {email: 'new-user@authwall.test', code});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);

        const provider = status2.providers.find(v => v.type === 'email');
        assert.ok(provider);
        assert.strictEqual(provider.value, 'new-user@authwall.test');
    });

    it('fails with missing fields', async function () {
        await this.http_post_json('/auth/magic-link/confirm');

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Missing fields');
    });

    it('treats loosely formatted email input as a normal identifier', async function () {
        await this.http_post_json('/auth/magic-link/confirm', {email: 'invalid-email', code: '123456'});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid or expired code');
    });

    it('fails with wrong code', async function () {
        await this.http_post_json('/auth/magic-link/request', {email: 'wrong-code@authwall.test'});
        await this.http_post_json('/auth/magic-link/confirm', {email: 'wrong-code@authwall.test', code: '000000'});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid or expired code');
        assert.strictEqual(status2.authenticated, false);
    });

    it('fails with expired code', async function () {
        await this.http_post_json('/auth/magic-link/request', {email: 'expired-code@authwall.test'});
        const {code} = this.sent_emails[0].placeholders;
        await db('magic_links').update({expires_at: date_trunc_ms()});
        await this.http_post_json('/auth/magic-link/confirm', {email: 'expired-code@authwall.test', code});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid or expired code');
        assert.strictEqual(status2.authenticated, false);
    });

});
