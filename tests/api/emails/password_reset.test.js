const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • password_reset', function () {

    it('should be sent after requesting password reset', async function () {
        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/password-reset/request', {email: 'mocha@authwall.test'});

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.password_reset];
        assert.deepStrictEqual(actual, expected);
    });

});
