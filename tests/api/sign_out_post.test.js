const assert = require('assert');

describe('POST /auth/sign-out', function () {

    it('requires authentication', async function () {
    });

    it('signs out authenticated user', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);
        await this.client.post_json('/auth/sign-out', {_csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.authenticated, false);
    });

});
