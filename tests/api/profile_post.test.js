const assert = require('assert');
const config = require('../../config');

describe('POST /auth/profile', function () {

    it('requires authentication', async function () {
    });

    it('updates display name', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        assert.strictEqual(status.display_name, null);
        await this.client.post_json('/auth/profile', {display_name: 'Mocha 123', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.display_name, 'Mocha 123');
    });

    it('uploads avatar image', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        assert.strictEqual(status.avatar_url, null);
        await this.client.post_multipart('/auth/profile', {
            _csrf: status.csrf_token,
            avatar: {
                path: `${__dirname}/../../logo.png`,
                filename: 'avatar.png',
                contentType: 'image/png',
            },
        });
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.avatar_url, `${config.public_url}/auth/uploads/${status.user_slug}/avatar.webp`);
    });

    it('changes password', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/profile', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass456', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

    it('sends password_changed email after password change', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/profile', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass456', _csrf: status.csrf_token});
        await this.wait_for_emails(2);
        assert.strictEqual(this.sent_emails[1].subject, 'Your password was changed');
    });

    it('fails password change with missing fields', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/profile', {current_password: 'pass123', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Missing fields');
    });

    it('fails password change when passwords do not match', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/profile', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass789', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Passwords do not match');
    });

    it('fails password change with wrong current password', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/profile', {current_password: 'wrong', password: 'pass456', password_confirm: 'pass456', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Current password is incorrect');
    });

});
