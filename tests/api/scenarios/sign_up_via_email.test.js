const assert = require('assert');
const config = require('../../../config');

describe('sign up via email | scenarios', function () {

    it('signup via email should mark the email as not verified', async function () {
        config.flows.password.min_password_length = 4;
        const email = 'mocha@authwall.test';
        const password = 'pass123';

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-up', {email, password, password_confirm: password, _csrf: status.csrf_token});

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
        assert.ok(status2.providers.find(v => v.type === 'email' && v.value === email).verified_at === null);
    });

    it('should send welcome email with verification link', async function () {
    });

});
