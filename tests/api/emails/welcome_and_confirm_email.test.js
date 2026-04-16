const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • welcome_and_confirm_email', function () {

    it('should be sent after successful signup using email and password', async function () {
        config.flows.password.min_password_length = 4;

        const email = 'mocha@authwall.test';
        const password = 'pass123';

        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-up', {email, password, password_confirm: password, _csrf: status.csrf_token});

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.welcome_and_confirm_email];
        assert.deepStrictEqual(actual, expected);
    });

});
