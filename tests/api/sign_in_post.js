const assert = require('assert');
const setup_server = require('../setup_servers');

describe('POST /auth/sign-in', function () {

    setup_server();

    it('signs in with username and password', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'foo', password: 'foo', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

    it('signs in with email and password', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'bar1@authwall.test', password: 'bar', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

    it('fails with missing fields', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {_csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Missing fields');
        assert.strictEqual(status2.authenticated, false);
    });

    it('fails with invalid username', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'xxx', password: 'xxx', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid username or password');
        assert.strictEqual(status2.authenticated, false);
    });

    it('fails with invalid email', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'foo@bar.com', password: 'xxx', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid username or password');
        assert.strictEqual(status2.authenticated, false);
    });

    it('fails with wrong password', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'foo', password: 'xxx', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid username or password');
        assert.strictEqual(status2.authenticated, false);
    });

});
