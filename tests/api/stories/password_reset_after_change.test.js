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
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/password-reset/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});
        const {token} = this.sent_emails[1].placeholders; // [0] is sign-in notification

        // User changes password from profile (legitimate action)
        const status2 = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/profile', {
            current_password: 'pass123',
            password: 'pass456',
            password_confirm: 'pass456',
            _csrf: status2.csrf_token,
        });

        // Now try to use the old reset token
        const status3 = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/password-reset/confirm', {
            token,
            password: 'hacked',
            password_confirm: 'hacked',
            _csrf: status3.csrf_token,
        });

        const status4 = await this.client.get_json('/auth/status');
        assert.strictEqual(status4.error, 'Invalid reset token');

        // Original password change must still hold
        await this.assert_password({username: 'mocha', password: 'pass456'});
    });

});
