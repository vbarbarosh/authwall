const assert = require('assert');
const config = require('../../../config');

// Gmail ignores dots in the local part of the address:
// john.doe@gmail.com and johndoe@gmail.com are the same inbox.
// The system must treat them as the same identity to prevent duplicate accounts
// and to ensure sign-in works regardless of how the user types their address.
describe('Gmail dot-insensitive email handling | stories', function () {

    it('prevents sign-up when dotless variant is already registered', async function () {
        config.flows.password.min_password_length = 4;

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-up', {
            email: 'john.doe@gmail.com',
            password: 'pass123',
            password_confirm: 'pass123',
            _csrf: status.csrf_token,
        });

        // Sign out, then try to sign up with the dotless variant
        await this.client.post_json('/auth/sign-out', {_csrf: (await this.client.get_json('/auth/status')).csrf_token});

        const status2 = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-up', {
            email: 'johndoe@gmail.com',
            password: 'pass456',
            password_confirm: 'pass456',
            _csrf: status2.csrf_token,
        });

        const status3 = await this.client.get_json('/auth/status');
        assert.strictEqual(status3.error, 'Email already exists');
        assert.strictEqual(status3.authenticated, false);
    });

    it('signs in with dotted variant when registered without dots', async function () {
        await this.add_user({email: 'johndoe@gmail.com', password: 'pass123'});

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {
            username: 'john.doe@gmail.com',
            password: 'pass123',
            _csrf: status.csrf_token,
        });

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

    it('signs in with dotless variant when registered with dots', async function () {
        await this.add_user({email: 'john.doe@gmail.com', password: 'pass123'});

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {
            username: 'johndoe@gmail.com',
            password: 'pass123',
            _csrf: status.csrf_token,
        });

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

    it('does not strip dots for non-Gmail domains', async function () {
        await this.add_user({email: 'john.doe@example.com', password: 'pass123'});

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {
            username: 'johndoe@example.com',
            password: 'pass123',
            _csrf: status.csrf_token,
        });

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.authenticated, false);
        assert.strictEqual(status2.error, 'Invalid username or password');
    });

});
