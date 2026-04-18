const assert = require('assert');
const config = require('../../../config');

// min_password_length applies only to NEW passwords being set.
// Existing passwords created under an older (shorter) minimum must still work.
// This allows the minimum to be raised without locking out existing users.
describe('min_password_length is enforced only for new passwords | stories', function () {

    it('rejects sign-up with a password shorter than the minimum', async function () {
        config.flows.password.min_password_length = 10;
        await this.http_post_json('/auth/sign-up', {
            username: 'mocha',
            password: 'short',
            password_confirm: 'short',
        });
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Password must be at least 10 characters',
            authenticated: false,
        });
    });

    it('rejects password reset with a password shorter than the current minimum', async function () {
        config.flows.password.min_password_length = 10;
        await this.add_user({email: 'mocha@authwall.test'});
        await this.http_post_json('/auth/password-reset/request', {email: 'mocha@authwall.test'});
        await this.http_post_json('/auth/password-reset/confirm', {
            token: this.sent_emails[0].placeholders.token,
            password: 'short',
            password_confirm: 'short',
        });
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Password must be at least 10 characters',
            authenticated: false,
        });
    });

    it('rejects profile password change with a password shorter than the current minimum', async function () {
        config.flows.password.min_password_length = 10;
        await this.sign_in({username: 'mocha', password: 'pass123456'});
        await this.http_post_json('/auth/profile', {
            current_password: 'pass123456',
            password: 'short',
            password_confirm: 'short',
        });
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Password must be at least 10 characters',
            authenticated: true,
        });
    });

    it('old short password still works for sign-in after the minimum is raised', async function () {
        config.flows.password.min_password_length = 10;

        // User registered when minimum was 4
        await this.add_user({username: 'mocha', password: 'pass'});

        // Minimum is raised to 10 — but the existing short password must still authenticate
        await this.http_post_json('/auth/sign-in', {
            username: 'mocha',
            password: 'pass',
        });
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });
    });

    it('old short password still works for change-password current_password check after minimum is raised', async function () {
        config.flows.password.min_password_length = 10;

        // User registered when minimum was 4
        await this.sign_in({username: 'mocha', password: 'pass'});

        // Minimum is raised to 10 — new password must meet it, but current is still accepted
        await this.http_post_json('/auth/change-password', {
            current_password: 'pass',
            password: 'newlongpass',
            password_confirm: 'newlongpass',
        });
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });

        await this.assert_password({username: 'mocha', password: 'newlongpass'});
    });

});
