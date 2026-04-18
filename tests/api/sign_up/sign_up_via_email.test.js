const assert = require('assert');
const config = require('../../../config');

describe('sign up via email | scenarios', function () {

    it('signup via email should mark the email as not verified', async function () {
        config.flows.password.min_password_length = 4;

        await this.http_post_json('/auth/sign-up', {
            email: 'mocha@authwall.test',
            password: 'pass123',
            password_confirm: 'pass123',
        });

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
            providers: [
                {
                    type: 'email',
                    value: 'mocha@authwall.test',
                    value_normalized: 'mocha@authwall.test',
                    verified_at: null
                },
            ],
        });
    });

    it('should send welcome email with verification link', async function () {
        config.flows.password.min_password_length = 4;

        await this.http_post_json('/auth/sign-up', {
            email: 'mocha@authwall.test',
            password: 'pass123',
            password_confirm: 'pass123',
        });

        await this.wait_for_emails(1);

        assert.strictEqual(this.sent_emails.length, 1);
        const email = this.sent_emails[0];
        assert.strictEqual(email.to, 'mocha@authwall.test');
        assert.ok(email.placeholders.link, 'verification link should be present');
        assert.ok(email.placeholders.link.includes('/auth/email-verify/confirm'), 'link should point to email verify confirm page');
    });

});
