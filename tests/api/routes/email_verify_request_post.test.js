const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');

describe('POST /auth/email-verify/request', function () {

    it('requires authentication', async function () {
        await this.http_post_json('/auth/email-verify/request');
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Authentication required',
        });
    });

    it('sends verification email', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/email-verify/request');
        await this.wait_for_emails(1);
        const sent_email = this.sent_emails.find(v => v.name === const_email.confirm_email);
        assert.ok(sent_email);
        assert.ok(sent_email.placeholders.link);
        assert.match(sent_email.placeholders.code, /^\d{6}$/);
        assert.strictEqual(sent_email.to, 'mocha@authwall.test');
    });

    it('allows requesting verification when email verification is enforced', async function () {
        config.confirm_email.required = true;

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/email-verify/request');
        await this.wait_for_emails(1);

        const sent_email = this.sent_emails.find(v => v.name === const_email.confirm_email);
        assert.ok(sent_email);
        assert.strictEqual(sent_email.to, 'mocha@authwall.test');
    });

    it('rate-limits repeated requests', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/email-verify/request');
        await this.http_post_json('/auth/email-verify/request');
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Verification email already sent. Please wait.',
        });
    });

    it('heals a stale session and does not error when the email is already verified', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: true});
        await this.http_post_json('/auth/email-verify/request');
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });
        assert.strictEqual(this.sent_emails.length, 0);
    });

    it('fails when the user has no email at all', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/email-verify/request');
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'No unverified email found',
        });
    });

});
