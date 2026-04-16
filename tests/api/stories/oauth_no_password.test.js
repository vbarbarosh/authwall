const assert = require('assert');

// User signed up via OAuth (email is verified, but no password was ever set).
// Trying to sign in with email + password must fail.
describe('OAuth user with no password tries email+password sign-in | stories', function () {

    it('fails with invalid credentials, not a password-specific error', async function () {
        // Create a user that has a verified email but no password (like an OAuth signup would)
        await this.add_user({email: 'oauth-user@authwall.test', password: null});

        await this.http_post_json('/auth/sign-in', {
            _csrf: await this.csrf_token(),
            username: 'oauth-user@authwall.test',
            password: 'anything',
        });

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.authenticated, false);
        // Must not reveal that the account exists or that no password is set
        assert.strictEqual(status2.error, 'Invalid username or password');
    });

});
