const assert = require('assert');
const const_email = require('../../src/helpers/const/const_email');

describe('POST /auth/sign-up', function () {

    it('signs up with username and password', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-up', {username: 'mocha', password: 'pass1', password_confirm: 'pass1', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

    it('signs up with email and password', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-up', {email: 'mocha@authwall.test', password: 'pass1', password_confirm: 'pass1', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
        assert.strictEqual(this.sent_emails[0].to, 'mocha@authwall.test');
        assert.strictEqual(this.sent_emails[0].name, const_email.welcome_and_confirm_email);
    });

    it('signs up with both email and username', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-up', {username: 'mocha', email: 'mocha@authwall.test', password: 'pass1', password_confirm: 'pass1', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
        assert.strictEqual(this.sent_emails[0].to, 'mocha@authwall.test');
        assert.strictEqual(this.sent_emails[0].name, const_email.welcome_and_confirm_email);
    });

    it('fails with missing fields');
    it('fails when passwords do not match');
    it('fails with invalid username');
    it('fails with invalid email');
    it('fails when username already exists');
    it('fails when email already exists');

});
