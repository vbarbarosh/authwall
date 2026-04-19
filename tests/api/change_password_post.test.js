const assert = require('assert');
const config = require('../../config');

describe('POST /auth/change-password', function () {

    it('requires authentication', async function () {
        await this.http_post_json('/auth/change-password', {
            current_password: 'pass123',
            password: 'pass456',
            password_confirm: 'pass456',
        });
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Authentication required',
        });
    });

    it('changes password for authenticated user', async function () {
        config.flows.password.min_password_length = 4;
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/change-password', {
            current_password: 'pass123',
            password: 'pass456',
            password_confirm: 'pass456',
        });
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
        });
        await this.assert_password({username: 'mocha', password: 'pass456'});
    });

    it('cannot set or change password without a verified email or username', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/change-password');
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Cannot set or change password without a verified email or username',
        });
    });

    it('fails with missing fields', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/change-password', {current_password: 'pass123'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Missing fields',
        });
    });

    it('fails when passwords do not match', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/change-password', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass789'});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Passwords do not match');
    });

    it('fails with wrong current password', async function () {
        config.flows.password.min_password_length = 4;
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/change-password', {current_password: 'wrong', password: 'pass456', password_confirm: 'pass456'});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Current password is incorrect');
    });

});
