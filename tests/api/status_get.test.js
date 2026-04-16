const assert = require('assert');

describe('GET /auth/status', function () {

    it('returns unauthenticated status for anonymous user', async function () {
        const status = await this.http_get_json('/auth/status');
        assert.deepStrictEqual(status.authenticated, false);
    });

    it('returns authenticated status with user info', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        assert.deepStrictEqual(status.authenticated, true);
    });

    it('clears error from session after returning it', async function () {
        await this.client.post_json('/auth/sign-in')
        const status = await this.http_get_json('/auth/status');
        assert.deepStrictEqual(status.error, 'Invalid CSRF Token');
        const status2 = await this.http_get_json('/auth/status');
        assert.deepStrictEqual(status2.error, null);
    });

});
