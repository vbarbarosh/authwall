const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • confirm_email', function () {

    it('should be sent after requesting email confirmation', async function () {
        await this.add_user({email: 'mocha@authwall.test', password: 'pass123', verified: false});

        await this.http_post_json('/auth/sign-in', {
            _csrf: await this.csrf_token(),
            username: 'mocha@authwall.test',
            password: 'pass123',
        });

        await this.http_post_json('/auth/email-verify/request', {
            _csrf: await this.csrf_token(),
        });

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.new_sign_in, const_email.confirm_email];
        assert.deepStrictEqual(actual, expected);
    });

});
