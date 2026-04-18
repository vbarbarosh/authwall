const assert = require('assert');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const date_trunc_ms = require('../../src/helpers/date/date_trunc_ms');
const db = require('../../db');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('GET /auth/magic-link/confirm', function () {

    it('signs in existing user via magic link token', async function () {
        const {email} = await this.add_user({email: 'mocha@authwall.test'});

        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/magic-link/request', {email, _csrf: status.csrf_token});

        const {token} = this.sent_emails[0].placeholders;
        const magic_link = await db('magic_links').where('token_hash', crypto_hash_sha256(token).toString('base64url')).first();
        assert.strictEqual(magic_link.used_at, null);

        await this.http_get_json(urlmod('/auth/magic-link/confirm', {token}));

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);

        const row = await db('magic_links').where('id', magic_link.id).first();
        assert.ok(row.used_at);
    });

    it('signs up new user via magic link token', async function () {
        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/magic-link/request', {email: 'new-user@authwall.test', _csrf: status.csrf_token});

        const {token} = this.sent_emails[0].placeholders;
        await this.http_get_json(urlmod('/auth/magic-link/confirm', {token}));

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);

        const provider = status2.providers.find(v => v.type === 'email');
        assert.ok(provider);
        assert.strictEqual(provider.value, 'new-user@authwall.test');
        assert.ok(provider.verified_at);
    });

    it('fails with missing token', async function () {
        await this.http_get_json('/auth/magic-link/confirm');

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Missing token');
        assert.strictEqual(status.authenticated, false);
    });

    it('fails with invalid token', async function () {
        await this.http_get_json(urlmod('/auth/magic-link/confirm', {token: 'invalid'}));

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Invalid or expired magic link');
        assert.strictEqual(status.authenticated, false);
    });

    it('fails with expired token', async function () {
        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/magic-link/request', {email: 'expired@authwall.test', _csrf: status.csrf_token});

        const {token} = this.sent_emails[0].placeholders;
        await db('magic_links').update({expires_at: date_trunc_ms()});
        await this.http_get_json(urlmod('/auth/magic-link/confirm', {token}));

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid or expired magic link');
        assert.strictEqual(status2.authenticated, false);
    });

});
