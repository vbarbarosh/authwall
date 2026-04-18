const assert = require('assert');
const config = require('../../../config');

// After a user changes their password from the profile page, any previously issued
// password-reset links must be invalidated. An attacker who obtained an old reset
// link should not be able to use it to regain access.
describe('Old password-reset link is invalid after profile password change | stories', function () {

    it('rejects the reset token after password was changed from profile', async function () {
        config.flows.password.min_password_length = 4;

        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});

        // Request a password reset (simulates attacker obtaining a link)
        await this.http_post_json('/auth/password-reset/request', {email: 'mocha@authwall.test'});

        // User changes password from profile (legitimate action)
        await this.http_post_json('/auth/profile', {
            current_password: 'pass123',
            password: 'pass456',
            password_confirm: 'pass456',
        });

        // Now try to use the old reset token
        await this.http_post_json('/auth/password-reset/confirm', {
            token: this.sent_emails[0].placeholders.token,
            password: 'hacked',
            password_confirm: 'hacked',
        });

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid reset token',
            authenticated: true,
        });

        // Original password change must still hold
        await this.assert_password({username: 'mocha', password: 'pass456'});
    });

});
