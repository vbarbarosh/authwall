const assert = require('assert');

describe('POST /auth/change-password', function () {

    it('requires authentication');

    it('changes password for authenticated user', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/change-password', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass456', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
    });

    it('fails with missing fields');
    it('fails when passwords do not match');
    it('fails with wrong current password');

});
