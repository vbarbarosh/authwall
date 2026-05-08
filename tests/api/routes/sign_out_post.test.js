const assert = require('assert');
const config = require('../../../config');

describe('POST /auth/sign-out', function () {

    it('signs out authenticated user', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);
        await this.http_post_json('/auth/sign-out');
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.authenticated, false);
    });

    it('allows sign-out when email verification is enforced', async function () {
        config.email_verification.required = true;

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);

        await this.http_post_json('/auth/sign-out');
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.authenticated, false);
    });

});
