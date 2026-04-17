const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • password_changed_via_reset_link', function () {

    it('should be sent after changing password from profile', async function () {
        config.flows.password.min_password_length = 4;

        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/change-password', {
            current_password: 'pass123',
            password: 'pass456',
            password_confirm: 'pass456',
        });

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.new_sign_in, const_email.password_changed_from_profile];
        assert.deepStrictEqual(actual, expected);
    });

});
