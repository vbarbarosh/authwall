const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • confirm_email_without_code', function () {

    it('should be sent after requesting email confirmation in link mode', async function () {
        config.confirm_email.mode = 'link';
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});

        await this.http_post_json('/auth/email-verify/request');

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.confirm_email_without_code];
        assert.deepStrictEqual(actual, expected);
    });

});
