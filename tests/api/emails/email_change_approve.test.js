const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • email_change_approve', function () {

    it('should be sent to the current primary when a change is requested', async function () {
        await this.sign_in({email: 'old@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/email-change/request', {email: 'new@authwall.test'});

        assert.deepStrictEqual(this.sent_emails.map(v => [v.name, v.to]), [[const_email.email_change_approve, 'old@authwall.test']]);
        assert.strictEqual(this.sent_emails[0].placeholders.new_email, 'new@authwall.test');
    });

});
