const assert = require('assert');

describe('CSRF protection', function () {

    it('rejects POST /auth/sign-in without token', async function () {
        await this.client.post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Invalid CSRF Token');
        assert.strictEqual(status.authenticated, false);
    });

    it('rejects POST /auth/sign-up without token', async function () {
        await this.client.post_json('/auth/sign-up', {username: 'mocha', password: 'pass1', password_confirm: 'pass1'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Invalid CSRF Token');
        assert.strictEqual(status.authenticated, false);
    });

    it('rejects POST /auth/password-reset/request without token', async function () {
        await this.client.post_json('/auth/password-reset/request', {email: 'mocha@authwall.test'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Invalid CSRF Token');
    });

    it('rejects POST /auth/magic-link/request without token', async function () {
        await this.client.post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Invalid CSRF Token');
    });

    it('rejects POST /auth/profile without token', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.client.post_json('/auth/profile', {display_name: 'Hacked'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Invalid CSRF Token');
        assert.strictEqual(status.display_name, null);
    });

    it('rejects POST with wrong token', async function () {
        await this.client.post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: 'wrong-token'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Invalid CSRF Token');
        assert.strictEqual(status.authenticated, false);
    });

});
