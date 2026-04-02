const assert = require('assert');
const setup_server = require('../setup_servers');

describe('smoke tests', function () {

    setup_server();

    it('GET /auth/status', async function () {
        const status = await this.client.get_json('/auth/status');
        status.csrf_token = typeof status.csrf_token;
        assert.deepStrictEqual(status, {
            error: null,
            authenticated: false,
            csrf_token: 'string',
        });
    });

    it('POST /auth/sign-in', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'foo', password: 'foo', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.authenticated, true);
    });

});
