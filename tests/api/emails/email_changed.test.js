const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • email_changed', function () {

    it('should be sent after confirming email change', async function () {
        await this.sign_in({email: 'old@authwall.test', password: 'pass123'});

        // request email change
        await this.http_post_json('/auth/email-change/request', {email: 'new@authwall.test'});

        // confirm email change using token from email
        await this.http_get_json(this.sent_emails[0].placeholders.confirm_link);

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.email_change_requested, const_email.email_changed];
        assert.deepStrictEqual(actual, expected);
    });

});
