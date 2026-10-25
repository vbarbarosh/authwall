const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • email_removed', function () {

    it('should be sent to the removed address itself (AW-92)', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        this.sent_emails.splice(0);

        await this.mark_confirmed({reason: 'email_remove'});
        await this.http_post_json('/auth/email/remove');
        await this.wait_for_emails(1);

        assert.deepStrictEqual(this.sent_emails.map(v => [v.name, v.to]), [[const_email.email_removed, 'mocha@authwall.test']]);
        assert.strictEqual(this.sent_emails[0].placeholders.email, 'mocha@authwall.test');
    });

    it('should not be sent to an address the account never verified', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/email/add', {email: 'typo@authwall.test'});
        this.sent_emails.splice(0);

        await this.http_post_json('/auth/email/remove');

        assert.deepStrictEqual(this.sent_emails, []);
    });

});
