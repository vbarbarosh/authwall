const assert = require('assert');
const config = require('../../../config');
const db = require('../../../db');
const const_email = require('../../../src/helpers/const/const_email');
const fs = require('fs');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');

const temp_uploads_dir = fs_path_resolve(__dirname, '../../../data/temp-uploads');

// The multipart body is parsed before anything can reject the request, so a
// rejected upload has already been written to disk by then.
function temp_upload_count()
{
    return fs.existsSync(temp_uploads_dir) ? fs.readdirSync(temp_uploads_dir).length : 0;
}

describe('POST /auth/profile', function () {

    it('requires authentication', async function () {
        await this.http_post_json('/auth/profile', {display_name: 'Hacker'});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Authentication required');
        assert.strictEqual(status2.authenticated, false);
    });

    it('updates display name', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.display_name, null);
        await this.http_post_json('/auth/profile', {display_name: 'Mocha 123'});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.display_name, 'Mocha 123');
    });

    it('requires verified email when email verification is enforced', async function () {
        config.confirm_email.required = true;

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/profile', {display_name: 'Mocha 123'});

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Email verification required');
        assert.strictEqual(status.display_name, null);
    });

    it('uploads avatar image', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.avatar_url, null);
        await this.client.post_multipart('/auth/profile', {
            _csrf: status.csrf_token,
            avatar: {
                path: `${__dirname}/../../../logo.png`,
                filename: 'avatar.png',
                contentType: 'image/png',
            },
        });
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.avatar_url, `${config.public_url}/auth/uploads/${status.user_slug}/avatar.webp`);
    });

    it('rejects an undecodable image without leaving a temp file', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const before = temp_upload_count();

        await this.client.post_multipart('/auth/profile', {
            _csrf: (await this.http_get_json('/auth/status')).csrf_token,
            avatar: new File([Buffer.from('not-a-real-png')], 'a.png', {type: 'image/png'}),
        });

        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Invalid image');
        assert.strictEqual(temp_upload_count(), before);
    });

    it('leaves no temp file when the upload is rejected by CSRF', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const before = temp_upload_count();

        await this.client.post_multipart('/auth/profile', {
            _csrf: 'wrong-token',
            avatar: new File([Buffer.from('not-a-real-png')], 'a.png', {type: 'image/png'}),
        });

        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Invalid CSRF Token');
        assert.strictEqual(temp_upload_count(), before);
    });

    it('changes password', async function () {
        config.flows.password.min_password_length = 4;
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/profile', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass456'});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        await this.assert_password({username: 'mocha', password: 'pass456'});
    });

    it('sends password_changed email after password change', async function () {
        config.flows.password.min_password_length = 4;
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/profile', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass456'});
        await this.wait_for_emails(1);
        assert.strictEqual(this.sent_emails[0].name, const_email.password_changed_from_profile);
    });

    it('sets an initial password when the account has none', async function () {
        config.flows.password.min_password_length = 4;
        const {user_id} = await this.sign_in({username: 'mocha', password: 'pass123'});
        // An account created through an OAuth provider: signed in, but with no
        // password to verify a current_password against.
        await db('users').where({id: user_id}).update({password_hash: null});

        await this.http_post_json('/auth/profile', {password: 'pass456', password_confirm: 'pass456'});

        assert.strictEqual((await this.http_get_json('/auth/status')).error, null);
        await this.assert_password({username: 'mocha', password: 'pass456'});
    });

    it('fails password change with missing fields', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/profile', {current_password: 'pass123'});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Missing fields');
    });

    it('fails password change when passwords do not match', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/profile', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass789'});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Passwords do not match');
    });

    it('fails password change with wrong current password', async function () {
        config.flows.password.min_password_length = 4;
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/profile', {current_password: 'wrong', password: 'pass456', password_confirm: 'pass456'});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Current password is incorrect');
    });

});
