const assert = require('assert');
const config = require('../../config');

describe('GET /auth/status', function () {

    it('returns unauthenticated status for anonymous user', async function () {
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: false,
        });
    });

    it('returns authenticated status with user info', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });
    });

    it('clears error from session after returning it', async function () {
        await this.http_post_json('/auth/sign-in', {_csrf: undefined});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {error: 'Invalid CSRF Token'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {error: null});
    });

    it('does not advertise email flows when mailer is disabled', async function () {
        config.mailer.enabled = false;
        config.flows.magic_link.enabled = false;
        config.flows.password.allow_email = false;

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.flows.magic_link, undefined);
        assert.partialDeepStrictEqual(status.flows.password, {
            allow_username: true,
            allow_email: false,
        });
    });

});
