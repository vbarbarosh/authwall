const assert = require('assert');
const config = require('../../../config');

// Identity values are rendered by the SPA and interpolated into e-mail bodies.
describe('identity value shapes | security', function () {

    beforeEach(function () {
        config.flows.password.min_password_length = 4;
    });

    it('rejects a username containing markup at sign-up', async function () {
        await this.http_post_json('/auth/sign-up', {username: '<img src=x onerror=alert(1)>', password: 'pass123', password_confirm: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Invalid username');
        assert.strictEqual(status.authenticated, false);
    });

    it('rejects an e-mail that is not a single plain address at sign-up and magic-link request', async function () {
        const crlf = String.fromCharCode(13, 10);
        for (const email of ['<img src=x>@x.test', 'a@x.test, b@y.test', 'a@x.test' + crlf + 'Bcc: b@y.test']) {
            await this.http_post_json('/auth/sign-up', {email, password: 'pass123', password_confirm: 'pass123'});
            assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Invalid email', email);
            await this.http_post_json('/auth/magic-link/request', {email});
            assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Invalid email', email);
        }
    });

    it('bounds the display name and strips control characters', async function () {
        const crlf = String.fromCharCode(13, 10);
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/profile', {display_name: 'x'.repeat(101)});
        assert.match((await this.http_get_json('/auth/status')).error, /at most 100/);
        await this.http_post_json('/auth/profile', {display_name: 'Jane' + crlf + 'Bcc: x@y.test Doe'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, null);
        assert.strictEqual(status.display_name, 'JaneBcc: x@y.test Doe');
    });

});
