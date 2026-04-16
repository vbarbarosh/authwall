const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • email_change_requested', function () {

    it('should be sent after requesting email change', async function () {
        await this.sign_in({email: 'old@authwall.test', password: 'pass123'});

        // request email change
        await this.http_post_json('/auth/email-change/request', {email: 'new@authwall.test'});

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.email_change_requested];
        assert.deepStrictEqual(actual, expected);
    });

});
