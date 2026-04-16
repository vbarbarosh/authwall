const assert = require('assert');

describe('smoke tests', function () {

    it('GET /auth/status', async function () {
        await this.client.get_json('/auth/status');
        const status = await this.client.get_json('/auth/status');
        const session = await this.client.get_session();
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: false,
            csrf_token: session.csrf_token,
        });
    });

    it('POST /auth/sign-in', async function () {
        await this.add_user({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.authenticated, true);
        assert.strictEqual(this.sent_emails[0].to, 'mocha@authwall.test');
        assert.strictEqual(this.sent_emails[0].subject, 'New sign-in to your account');
        assert.ok(this.written_logs.length > 0);
    });

    it('GET /auth/dev', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        try {
            await this.client.get_json('/auth/dev');
        }
        catch (error) {
            assert.strictEqual(error.message, 'Request failed with status code 404');
            return;
        }
        assert.ok(false);
    });

});
