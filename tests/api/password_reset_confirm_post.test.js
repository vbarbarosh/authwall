const assert = require('assert');
const config = require('../../config');
const const_email = require('../../src/helpers/const/const_email');
const db = require('../../db');

describe('POST /auth/password-reset/confirm', function () {

    it('resets password with valid token', async function () {
        config.flows.password.min_password_length = 4;

        await this.add_user({email: 'mocha@authwall.test'});

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, null);
        assert.strictEqual(status.authenticated, false);

        await this.client.post_json('/auth/password-reset/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, false);

        assert.strictEqual(this.sent_emails[0].to, 'mocha@authwall.test');
        assert.strictEqual(this.sent_emails[0].name, const_email.password_reset);
        const {token} = this.sent_emails[0].placeholders;

        await this.client.post_json('/auth/password-reset/confirm', {token, password: 'pass123', password_confirm: 'pass123', _csrf: status.csrf_token});
        const status3 = await this.http_get_json('/auth/status');
        assert.strictEqual(status3.error, null);
        assert.strictEqual(status3.authenticated, false);

        await this.assert_password({email: 'mocha@authwall.test', password: 'pass123'});
    });

    it('fails with missing fields', async function () {
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/password-reset/confirm', {_csrf: status.csrf_token});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Missing fields');
    });

    it('fails when passwords do not match', async function () {
        await this.add_user({email: 'mocha@authwall.test'});
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/password-reset/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});
        const {token} = this.sent_emails[0].placeholders;
        await this.client.post_json('/auth/password-reset/confirm', {token, password: 'pass123', password_confirm: 'pass456', _csrf: status.csrf_token});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Passwords do not match');
    });

    it('fails with invalid token', async function () {
        config.flows.password.min_password_length = 4;
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/password-reset/confirm', {token: 'invalid-token', password: 'pass123', password_confirm: 'pass123', _csrf: status.csrf_token});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid reset token');
    });

    it('fails with already used token', async function () {
        config.flows.password.min_password_length = 4;
        await this.add_user({email: 'mocha@authwall.test'});
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/password-reset/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});
        const {token} = this.sent_emails[0].placeholders;
        // Use it once (valid)
        await this.client.post_json('/auth/password-reset/confirm', {token, password: 'pass123', password_confirm: 'pass123', _csrf: status.csrf_token});
        // Try to use it again
        const status2 = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/password-reset/confirm', {token, password: 'pass456', password_confirm: 'pass456', _csrf: status2.csrf_token});
        const status3 = await this.http_get_json('/auth/status');
        assert.strictEqual(status3.error, 'Reset token already used');
    });

    it('fails with expired token', async function () {
        config.flows.password.min_password_length = 4;
        await this.add_user({email: 'mocha@authwall.test'});
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/password-reset/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});
        const {token} = this.sent_emails[0].placeholders;
        await db('password_reset_tokens').update({expires_at: new Date(Date.now() - 1000)});
        await this.client.post_json('/auth/password-reset/confirm', {token, password: 'pass123', password_confirm: 'pass123', _csrf: status.csrf_token});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Reset token expired');
    });

});
