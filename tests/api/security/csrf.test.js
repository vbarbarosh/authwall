const assert = require('assert');

const _csrf = undefined;

describe('CSRF protection', function () {

    it('rejects POST /auth/sign-in without token', async function () {
        await this.http_post_json('/auth/sign-in', {_csrf, username: 'mocha', password: 'pass123'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid CSRF Token',
            authenticated: false,
        });
    });

    it('rejects POST /auth/sign-up without token', async function () {
        await this.http_post_json('/auth/sign-up', {_csrf, username: 'mocha', password: 'pass1', password_confirm: 'pass1'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid CSRF Token',
            authenticated: false,
        });
    });

    it('rejects POST /auth/password-reset/request without token', async function () {
        await this.http_post_json('/auth/password-reset/request', {_csrf, email: 'mocha@authwall.test'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid CSRF Token',
            authenticated: false,
        });
    });

    it('rejects POST /auth/magic-link/request without token', async function () {
        await this.http_post_json('/auth/magic-link/request', {_csrf, email: 'mocha@authwall.test'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid CSRF Token',
            authenticated: false,
        });
    });

    it('rejects POST /auth/profile without token', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/profile', {_csrf, display_name: 'Hacked'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid CSRF Token',
            authenticated: true,
            display_name: null,
        });
    });

    it('rejects POST /auth/account/remove without token', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/account/remove', {_csrf, confirmation: 'DELETE'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid CSRF Token',
            authenticated: true,
        });
    });

    it('rejects POST with wrong token', async function () {
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: 'wrong-token'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid CSRF Token',
            authenticated: false
        });
    });

});
