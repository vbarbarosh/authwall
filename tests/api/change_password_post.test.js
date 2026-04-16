const assert = require('assert');
const db = require('../../db');

describe('POST /auth/change-password', function () {

    it('requires authentication', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/change-password', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass456', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Authentication required');
    });

    it('changes password for authenticated user', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/change-password', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass456', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        await this.assert_password({username: 'mocha', password: 'pass456'});
    });

    it('Cannot set or change password without a verified email or username', async function () {
        const {user_id} = await this.sign_in({username: 'mocha', password: 'pass123'});
        await db('user_identities').where({user_id}).del();
        await db('users').where({id: user_id}).update({password_hash: null});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/change-password', {_csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Cannot set or change password without a verified email or username');
    });

    it('fails with missing fields', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/change-password', {current_password: 'pass123', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Missing fields');
    });

    it('fails when passwords do not match', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/change-password', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass789', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Passwords do not match');
    });

    it('fails with wrong current password', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/change-password', {current_password: 'wrong', password: 'pass456', password_confirm: 'pass456', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Current password is incorrect');
    });

});
