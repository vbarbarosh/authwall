const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');

// A signed-in user adds an email from the profile page that the access rules
// reject. The add must fail with a friendly message and leave the account
// untouched — no email identity attached, no verification email sent.
describe('User adds a disallowed email from the profile page | stories', function () {

    beforeEach(function () {
        config.access.allowed_domains = ['authwall.test'];
        config.access.allowed_emails = [];
        config.access.denied_domains = [];
        config.access.denied_emails = [];
    });

    it('rejects the email with a friendly error and adds nothing', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});

        await this.http_post_json('/auth/email/add', {email: 'outsider@example.com'});

        // status.error is flash-cleared on read, so check the error and the
        // unchanged providers from a single /auth/status fetch.
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);
        assert.strictEqual(status.error, 'Email domain is not allowed');
        assert.strictEqual(status.providers.filter(v => v.type === const_user_identity.email).length, 0);
        assert.strictEqual(this.sent_emails.length, 0);
    });

});
