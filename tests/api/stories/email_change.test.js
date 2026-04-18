const assert = require('assert');
const config = require('../../../config');
const mock_google = require('../../mock_google');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// User has email+password and Google linked.
// After changing their email, sign-in with the old email must fail,
// but Google sign-in must still work.
describe('Email change invalidates old email sign-in | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    it('old email sign-in fails after email change; Google sign-in still works', async function () {
        // Set up: user with email+password and Google linked
        await this.sign_in({email: 'old@authwall.test', password: 'pass123'});

        // Connect Google
        mock_google();
        await this.client.get_json_no_redirects('/auth/google?connect=1');
        await this.http_get_json(urlmod('/auth/google/callback', {
            code: 'fake_code',
            state: await this.client.get_session().then(v => v.oauth_state),
        }));

        const status1 = await this.http_get_json('/auth/status');
        assert.ok(status1.providers.find(v => v.type === 'oauth_google'));

        // Request email change
        await this.http_post_json(config.pages.email_change_request, {email: 'new@authwall.test'});

        const change_email = this.sent_emails.find(v => v.placeholders?.token && v.to === 'new@authwall.test');
        assert.ok(change_email, 'email change confirmation email should be sent');

        // Confirm email change
        await this.http_get_json(urlmod(config.pages.email_change_confirm, {token: change_email.placeholders.token}));

        // Old email sign-in must now fail
        await this.http_post_json('/auth/sign-out');
        await this.http_post_json('/auth/sign-in', {username: 'old@authwall.test', password: 'pass123'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid username or password',
            authenticated: false,
        });

        // Google sign-in must still work
        mock_google();
        await this.client.get_json_no_redirects('/auth/google');
        await this.http_get_json(urlmod('/auth/google/callback', {
            code: 'fake_code',
            state: await this.client.get_session().then(v => v.oauth_state),
        }));

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });
    });

});
