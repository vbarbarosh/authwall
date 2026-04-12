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

});
