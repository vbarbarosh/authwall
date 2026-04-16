const assert = require('assert');

describe('POST /auth/password-reset/confirm', function () {

    it('resets password with valid token', async function () {
        await this.add_user({email: 'mocha@authwall.test'});

        const status = await this.client.get_json('/auth/status');
        assert.strictEqual(status.error, null);
        assert.strictEqual(status.authenticated, false);

        await this.client.post_json('/auth/password-reset/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, false);

        assert.strictEqual(this.sent_emails[0].to, 'mocha@authwall.test');
        assert.strictEqual(this.sent_emails[0].subject, 'Reset your password');
        const {token} = this.sent_emails[0].placeholders;

        await this.client.post_json('/auth/password-reset/confirm', {token, password: 'pass123', password_confirm: 'pass123', _csrf: status.csrf_token});
        const status3 = await this.client.get_json('/auth/status');
        assert.strictEqual(status3.error, null);
        assert.strictEqual(status3.authenticated, false);

        await this.assert_password({email: 'mocha@authwall.test', password: 'pass123'});
    });

    it('fails with missing fields');
    it('fails when passwords do not match');
    it('fails with invalid token');
    it('fails with already used token');
    it('fails with expired token');

});
