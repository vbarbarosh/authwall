const assert = require('assert');

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

});
