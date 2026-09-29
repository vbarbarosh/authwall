const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • confirm_code', function () {

    it('should be sent to the primary address when a code is requested', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/confirm/request');
        await this.wait_for_emails(1);

        assert.deepStrictEqual(this.sent_emails.map(v => [v.name, v.to]), [[const_email.confirm_code, 'mocha@authwall.test']]);
        assert.match(this.sent_emails[0].placeholders.code, /^\d{6}$/);
    });

});
