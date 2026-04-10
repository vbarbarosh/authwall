const assert = require('assert');

describe('sign up via magic link | scenarios', function () {

    it('signup via magic link should automatically mark the email as verified', async function () {
        const email = 'mocha@authwall.test';

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email, _csrf: status.csrf_token});

        const [, code] = this.sent_emails[0].text.match(/confirmation page:\s*(\d+)/i);
        await this.client.post_json('/auth/magic-link/confirm', {email, code, _csrf: status.csrf_token});

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
        assert.ok(status2.providers.find(v => v.type === 'email' && v.value === email).verified_at !== null);
    });

});
