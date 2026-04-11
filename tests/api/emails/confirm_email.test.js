const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • confirm_email', function () {

    it('should be sent after requesting email confirmation', async function () {
        const email = 'mocha@authwall.test';
        const password = 'pass123';

        await this.add_user({email, password, verified: false});

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: email, password, _csrf: status.csrf_token});

        const status2 = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/email-verify/request', {_csrf: status2.csrf_token});

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.new_sign_in, const_email.confirm_email];
        assert.deepStrictEqual(actual, expected);
    });

});
