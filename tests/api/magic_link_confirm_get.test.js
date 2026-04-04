const assert = require('assert');
const db = require('../../db');

describe('GET /auth/magic-link/confirm', function () {

    it('signs in existing user via magic link token', async function () {
        const user = await this.add_user({email: 'mocha@authwall.test'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email: user.email, _csrf: status.csrf_token});

        const [, token] = this.sent_emails[0].text.match(/confirm\?token=([^\s]+)/);
        await this.client.get_json(`/auth/magic-link/confirm?token=${token}`);

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);

        const row = await db('magic_links').first();
        assert.ok(row.used_at);
    });

    it('signs up new user via magic link token', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email: 'new-user@authwall.test', _csrf: status.csrf_token});

        const [, token] = this.sent_emails[0].text.match(/confirm\?token=([^\s]+)/);
        await this.client.get_json(`/auth/magic-link/confirm?token=${token}`);

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);

        const provider = status2.providers.find(v => v.type === 'email');
        assert.ok(provider);
        assert.strictEqual(provider.value, 'new-user@authwall.test');
        assert.ok(provider.verified_at);
    });

    it('fails with missing token', async function () {
        await this.client.get_json('/auth/magic-link/confirm');

        const status = await this.client.get_json('/auth/status');
        assert.strictEqual(status.error, 'Missing token');
        assert.strictEqual(status.authenticated, false);
    });

    it('fails with invalid token', async function () {
        await this.client.get_json('/auth/magic-link/confirm?token=invalid');

        const status = await this.client.get_json('/auth/status');
        assert.strictEqual(status.error, 'Invalid or expired magic link');
        assert.strictEqual(status.authenticated, false);
    });

    it('fails with expired token', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email: 'expired@authwall.test', _csrf: status.csrf_token});

        const [, token] = this.sent_emails[0].text.match(/confirm\?token=([^\s]+)/);
        await db('magic_links').update({expires_at: new Date(Date.now() - 1000)});
        await this.client.get_json(`/auth/magic-link/confirm?token=${token}`);

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid or expired magic link');
        assert.strictEqual(status2.authenticated, false);
    });

});
