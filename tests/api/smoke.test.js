const assert = require('assert');
const const_email = require('../../src/helpers/const/const_email');
const pkg = require('../../package.json');

describe('smoke tests', function () {

    it('GET /auth/status', async function () {
        const status = await this.http_get_json('/auth/status');
        const session = await this.client.get_session();
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: false,
            version: pkg.version,
            csrf_token: session.csrf_token,
        });
    });

    it('POST /auth/sign-in', async function () {
        await this.add_user({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });
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

    it('GET /auth/health', async function () {
        assert.partialDeepStrictEqual(await this.client.get_json_no_redirects('/auth/health'), {
            status: 200,
            statusText: 'OK',
            data: 'OK',
            headers: {
                'x-authwall-version': pkg.version,
            },
        });
    });

    it('GET /auth/sidecar', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        assert.partialDeepStrictEqual(await this.client.get_json_no_redirects('/auth/sidecar'), {
            status: 200,
            statusText: 'OK',
            data: '',
        });
    });

});
