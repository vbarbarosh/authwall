const assert = require('assert');
const config = require('../../../config');

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
        assert.strictEqual(status.flows.confirm_email, undefined);
        assert.partialDeepStrictEqual(status.flows.password, {
            allow_username: true,
            allow_email: false,
        });
    });

    it('returns pending email confirmation expiration when a token exists', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/email-verify/request');

        const status = await this.http_get_json('/auth/status');
        assert.match(status.confirm_email.expires_at, /^\d{4}-\d{2}-\d{2}T/);
        assert.match(status.confirm_email.resend_available_at, /^\d{4}-\d{2}-\d{2}T/);
    });

});
