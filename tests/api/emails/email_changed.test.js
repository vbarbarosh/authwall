const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • email_changed', function () {

    it('should be sent after confirming email change', async function () {
        const email = 'old@authwall.test';
        const new_email = 'new@authwall.test';
        const password = 'pass123';

        await this.add_user({email, password});

        // sign in
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {
            username: email,
            password,
            _csrf: status.csrf_token,
        });

        // request email change
        const status2 = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/email-change/request', {
            email: new_email,
            _csrf: status2.csrf_token,
        });

        // confirm email change using token from email
        await this.http_get_json(this.sent_emails[1].placeholders.confirm_link);

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.new_sign_in, const_email.email_change_requested, const_email.email_changed];
        assert.deepStrictEqual(actual, expected);
    });

});
