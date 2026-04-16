const assert = require('assert');

// User signed up via OAuth (email is verified, but no password was ever set).
// Trying to sign in with email + password must fail.
describe('OAuth user with no password tries email+password sign-in | stories', function () {

    it('fails with invalid credentials, not a password-specific error', async function () {
        // Create a user that has a verified email but no password (like an OAuth signup would)
        await this.add_user({email: 'oauth-user@authwall.test', password: null});

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {
            username: 'oauth-user@authwall.test',
            password: 'anything',
            _csrf: status.csrf_token,
        });

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.authenticated, false);
        // Must not reveal that the account exists or that no password is set
        assert.strictEqual(status2.error, 'Invalid username or password');
    });

});
