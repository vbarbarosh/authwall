const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • password_changed_via_reset_link', function () {

    it('should be sent after successful password reset confirmation', async function () {
        config.flows.password.min_password_length = 4;

        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});

        // request reset
        await this.http_post_json('/auth/password-reset/request', {email: 'mocha@authwall.test'});

        // confirm reset using token from email
        const token = this.sent_emails[0].placeholders.token;

        await this.http_post_json('/auth/password-reset/confirm', {
            token,
            password: 'pass456',
            password_confirm: 'pass456',
        });

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.password_reset, const_email.password_changed_via_reset_link];
        assert.deepStrictEqual(actual, expected);
    });

});
