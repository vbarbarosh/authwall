const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • password_changed_via_reset_link', function () {

    it('should be sent after changing password from profile', async function () {
        config.flows.password.min_password_length = 4;

        const email = 'mocha@authwall.test';
        const password = 'pass123';
        const new_password = 'pass456';

        await this.add_user({email, password});

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: email, password, _csrf: status.csrf_token});

        const status2 = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/change-password', {
            current_password: password,
            password: new_password,
            password_confirm: new_password,
            _csrf: status2.csrf_token,
        });

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.new_sign_in, const_email.password_changed_from_profile];
        assert.deepStrictEqual(actual, expected);
    });

});
