const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • welcome_and_confirm_email', function () {

    it('should be sent after successful signup using email and password', async function () {
        config.flows.password.min_password_length = 4;

        await this.http_post_json('/auth/sign-up', {
            email: 'mocha@authwall.test',
            password: 'pass123',
            password_confirm: 'pass123',
        });

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.welcome_and_confirm_email];
        assert.deepStrictEqual(actual, expected);
    });

});
