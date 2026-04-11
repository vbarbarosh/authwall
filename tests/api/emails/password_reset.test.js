const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • password_reset', function () {

    it('should be sent after requesting password reset', async function () {
        const email = 'mocha@authwall.test';
        const password = 'pass123';

        await this.add_user({email, password});

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/password-reset/request', {email, _csrf: status.csrf_token});

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.password_reset];
        assert.deepStrictEqual(actual, expected);
    });

});
