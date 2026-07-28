const assert = require('assert');
const config = require('../../../config');

// A user signed up as Old.Email@Gmail.com and changes their email to
// New.Email@Gmail.com. The profile must keep showing the address exactly as
// entered, while the normalized form (newemail@gmail.com) stays the key used
// for uniqueness checks and sign-in.
describe('Email change preserves the entered address | stories', function () {

    it('shows the entered address on the profile and signs in by the normalized one', async function () {
        const email = 'Old.Email@Gmail.com';
        const new_email = 'New.Email@Gmail.com';
        const new_email_normalized = 'newemail@gmail.com';
        const password = 'pass123';

        await this.sign_in({email, password});

        // Request and confirm the email change
        await this.http_post_json(config.pages.email_change_request, {email: new_email});

        const change_email = this.sent_emails.find(v => v.placeholders?.confirm_link);
        assert.ok(change_email, 'email change confirmation email should be sent');

        await this.http_get_json(change_email.placeholders.confirm_link);

        // The profile shows what the user entered; matching uses the normalized form
        const status2 = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status2.providers.filter(v => v.type === 'email'), [{
            value: new_email,
            value_normalized: new_email_normalized,
        }]);

        // Sign-in by the normalized form must not change the displayed address
        await this.http_post_json('/auth/sign-out');
        await this.http_post_json('/auth/sign-in', {username: new_email_normalized, password});

        const status3 = await this.http_get_json('/auth/status');
        assert.strictEqual(status3.error, null);
        assert.strictEqual(status3.authenticated, true);
        assert.partialDeepStrictEqual(status3.providers.filter(v => v.type === 'email'), [{
            value: new_email,
            value_normalized: new_email_normalized,
        }]);
    });

});
