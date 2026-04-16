const assert = require('assert');
const const_email = require('../../src/helpers/const/const_email');

describe('POST /auth/email-verify/request', function () {

    it('sends verification email', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/email-verify/request', {_csrf: status.csrf_token});
        await this.wait_for_emails(2); // sign-in notification + verify email
        const verify_email = this.sent_emails.find(e => e.name === const_email.confirm_email);
        assert.ok(verify_email);
        assert.strictEqual(verify_email.to, 'mocha@authwall.test');
        assert.ok(verify_email.placeholders.link);
    });

    it('rate-limits repeated requests', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/email-verify/request', {_csrf: status.csrf_token});
        await this.client.post_json('/auth/email-verify/request', {_csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Verification email already sent. Please wait.');
    });

    it('fails when no unverified email exists', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: true});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/email-verify/request', {_csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'No unverified email found');
    });

    it('requires authentication', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/email-verify/request', {_csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Authentication required');
    });

});
