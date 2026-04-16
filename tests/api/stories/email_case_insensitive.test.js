const assert = require('assert');

// Email lookup must be case-insensitive: a user who signed up as User@Example.com
// must be able to sign in as user@example.com.
describe('Case-insensitive email sign-in | stories', function () {

    it('signs in with lowercase when registered with mixed-case email', async function () {
        await this.add_user({email: 'MixedCase@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/sign-in', {
            username: 'mixedcase@authwall.test',
            password: 'pass123',
        });

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

    it('signs in with mixed-case when registered with lowercase email', async function () {
        await this.add_user({email: 'lowercase@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/sign-in', {
            username: 'LOWERCASE@authwall.test',
            password: 'pass123',
        });

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

});
