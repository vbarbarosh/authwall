const assert = require('assert');
const config = require('../../../config');
const nock = require('nock').default;
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// A passwordless account (OAuth or magic-link) adds a password and then uses
// it. See set_first_password.md.
describe('Setting a first password | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    it('accepts a new password without a current one, then signs in with it', async function () {
        await this.add_user({email: 'nopass@authwall.test', password: null});

        // Sign in the only way this account can — a magic link.
        await this.http_post_json('/auth/magic-link/request', {email: 'nopass@authwall.test'});
        await this.wait_for_emails(1);
        const {link} = this.sent_emails.find(v => v.placeholders?.link).placeholders;
        await this.open_link(urlmod(config.pages.magic_link_confirm, {
            token: new URL(link).searchParams.get('token'),
        }));
        // The profile's form is "Set a password", with no current one (M-13).
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: true,
            has_password: false,
            actions: {can_change_password: true},
        });

        // No current_password: there is none to verify against.
        await this.mark_confirmed({reason: 'first_password'});
        await this.http_post_json('/auth/change-password', {
            password: 'newpassword',
            password_confirm: 'newpassword',
        });
        // From now on it is "Change password", with the current one.
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            has_password: true,
            actions: {can_change_password: true},
        });

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

    it('tells an account with no verified email or username that it cannot take one (M-13)', async function () {
        // Bea's Google account gives no address.
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {sub: 'bea-google', name: 'Bea', picture: null, email: null, email_verified: false});
        await this.client.get_json_no_redirects('/auth/google');
        const {oauth_state} = await this.client.get_session();
        await this.client.get_json(urlmod('/auth/google/callback', {state: oauth_state, code: 'fake_code'}));

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: true,
            has_password: false,
            actions: {can_change_password: false},
        });

        await this.mark_confirmed({reason: 'first_password'});
        await this.http_post_json('/auth/change-password', {
            password: 'beas-password',
            password_confirm: 'beas-password',
        });
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Cannot set or change password without a verified email or username',
            has_password: false,
        });
    });

});
