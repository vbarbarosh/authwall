const assert = require('assert');

describe('sign up via username | scenarios', function () {

    it('happy path', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-up', {username: 'mocha', password: 'pass123', password_confirm: 'pass123', _csrf: status.csrf_token});

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

});
