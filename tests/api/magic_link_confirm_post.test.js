const assert = require('assert');
const db = require('../../db');

describe('POST /auth/magic-link/confirm', function () {

    it('signs in existing user with code', async function () {
        const user = await this.add_user({email: 'mocha@authwall.test'});
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email: user.email, _csrf: status.csrf_token});

        const {code} = this.sent_emails[0].placeholders;
        await this.client.post_json('/auth/magic-link/confirm', {email: user.email, code, _csrf: status.csrf_token});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

    it('signs up new user with code', async function () {
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email: 'new-user@authwall.test', _csrf: status.csrf_token});

        const {code} = this.sent_emails[0].placeholders;
        await this.client.post_json('/auth/magic-link/confirm', {email: 'new-user@authwall.test', code, _csrf: status.csrf_token});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);

        const provider = status2.providers.find(v => v.type === 'email');
        assert.ok(provider);
        assert.strictEqual(provider.value, 'new-user@authwall.test');
    });

    it('fails with missing fields', async function () {
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/confirm', {_csrf: status.csrf_token});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Missing fields');
    });

    it('treats loosely formatted email input as a normal identifier', async function () {
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/confirm', {email: 'invalid-email', code: '123456', _csrf: status.csrf_token});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid or expired code');
    });

    it('fails with wrong code', async function () {
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email: 'wrong-code@authwall.test', _csrf: status.csrf_token});
        await this.client.post_json('/auth/magic-link/confirm', {email: 'wrong-code@authwall.test', code: '000000', _csrf: status.csrf_token});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid or expired code');
        assert.strictEqual(status2.authenticated, false);
    });

    it('fails with expired code', async function () {
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email: 'expired-code@authwall.test', _csrf: status.csrf_token});
        const {code} = this.sent_emails[0].placeholders;
        await db('magic_links').update({expires_at: new Date(Date.now() - 1000)});
        await this.client.post_json('/auth/magic-link/confirm', {email: 'expired-code@authwall.test', code, _csrf: status.csrf_token});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid or expired code');
        assert.strictEqual(status2.authenticated, false);
    });

});
