const assert = require('assert');
const const_email = require('../../src/helpers/const/const_email');

describe('smoke tests', function () {

    it('GET /auth/health', async function () {
        const r = await this.client.get_json_no_redirects('/auth/health');
        assert.partialDeepStrictEqual(r, {
            status: 200,
            statusText: 'OK',
            data: 'OK',
        });
    });

    it('GET /auth/status', async function () {
        await this.http_get_json('/auth/status');
        const status = await this.http_get_json('/auth/status');
        const session = await this.client.get_session();
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: false,
            csrf_token: session.csrf_token,
        });
    });

    it('POST /auth/sign-in', async function () {
        await this.add_user({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: status.csrf_token});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.authenticated, true);
        assert.strictEqual(this.sent_emails[0].to, 'mocha@authwall.test');
        assert.strictEqual(this.sent_emails[0].name, const_email.new_sign_in);
        assert.ok(this.written_logs.length > 0);
    });

    it('GET /auth/dev', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        try {
            await this.http_get_json('/auth/dev');
        }
        catch (error) {
            assert.strictEqual(error.message, 'Request failed with status code 404');
            return;
        }
        assert.ok(false);
    });

});
