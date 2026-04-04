const assert = require('assert');
const setup_servers = require('../setup_servers');

describe('POST /auth/sign-out', function () {

    setup_servers();

    it('requires authentication', async function () {
    });

    it('signs out authenticated user', async function () {
        await this.sign_in();
        const status = await this.client.get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);
        await this.client.post_json('/auth/sign-out', {_csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.authenticated, false);
    });

});
