const assert = require('assert');
const config = require('../../../config');

describe('sign up via username | scenarios', function () {

    it('happy path', async function () {
        config.flows.password.min_password_length = 4;

        const username = 'mocha';
        const password = 'pass123';

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-up', {username, password, password_confirm: password, _csrf: status.csrf_token});

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

});
