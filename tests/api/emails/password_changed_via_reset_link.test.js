const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • password_changed_via_reset_link', function () {

    it('should be sent after successful password reset confirmation', async function () {
        config.flows.password.min_password_length = 4;

        const email = 'mocha@authwall.test';
        const password = 'pass123';
        const new_password = 'pass456';

        await this.add_user({email, password});

        // request reset
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/password-reset/request', {email, _csrf: status.csrf_token});

        // confirm reset using token from email
        const token = this.sent_emails[0].placeholders.token;

        await this.client.post_json('/auth/password-reset/confirm', {
            token,
            password: new_password,
            password_confirm: new_password,
            _csrf: status.csrf_token,
        });

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.password_reset, const_email.password_changed_via_reset_link];
        assert.deepStrictEqual(actual, expected);
    });

});
