const assert = require('assert');

describe('smoke tests', function () {

    it('GET /auth/status', async function () {
        await this.client.get_json('/auth/status');
        const status = await this.client.get_json('/auth/status');
        const session = await this.client.get_session();
        assert.deepStrictEqual(status, {
            error: null,
            authenticated: false,
            csrf_token: session.csrf_token,
        });
    });

    it('POST /auth/sign-in', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'bar', password: 'bar', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.authenticated, true);
        assert.strictEqual(this.sent_emails[0].subject, 'New sign-in to your account');
        assert.ok(this.written_logs.length > 0);
    });

});
