const assert = require('assert');
const config = require('../../../config');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// A passwordless account (OAuth or magic-link) adds a password and then uses
// it. See set_first_password.md.
describe('Setting a first password | stories', function () {

    it('accepts a new password without a current one, then signs in with it', async function () {
        await this.add_user({email: 'nopass@authwall.test', password: null});

        // Sign in the only way this account can — a magic link.
        await this.http_post_json('/auth/magic-link/request', {email: 'nopass@authwall.test'});
        await this.wait_for_emails(1);
        const {link} = this.sent_emails.find(v => v.placeholders?.link).placeholders;
        await this.http_get_json(urlmod(config.pages.magic_link_confirm, {
            token: new URL(link).searchParams.get('token'),
        }));
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);

        // No current_password: there is none to verify against.
        await this.http_post_json('/auth/change-password', {
            password: 'newpassword',
            password_confirm: 'newpassword',
        });
        assert.strictEqual((await this.http_get_json('/auth/status')).error, null);

        await this.http_post_json('/auth/sign-out');
        await this.http_post_json('/auth/sign-in', {
            username: 'nopass@authwall.test',
            password: 'newpassword',
        });

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });
    });

});
