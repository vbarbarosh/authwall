const assert = require('assert');

describe('POST /auth/password-reset/request', function () {

    it('sends reset email for known email', async function () {
        const user = await this.add_user();
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/password-reset/request', {email: user.email, _csrf: status.csrf_token});
        assert.strictEqual(this.sent_emails[0].to, user.email);
        assert.strictEqual(this.sent_emails[0].subject, 'Reset your password');
    });

    it('redirects silently for unknown email', async function () {
         await this.add_user();
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/password-reset/request', {email: 'invalid-email@authwall.test', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.deepStrictEqual(status2.error, null);
        assert.deepStrictEqual(status2.authenticated, false);
        assert.deepStrictEqual(this.sent_emails, []);
    });

    it('fails with missing email');
    it('fails with invalid email');

});
