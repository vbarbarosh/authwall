const assert = require('assert');
const config = require('../../../config');
const nock = require('nock');
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

    afterEach(function () {
        config.flows.google.enabled = false;
    });

    it('old email sign-in fails after email change; Google sign-in still works', async function () {
        // Set up: user with email+password and Google linked
        await this.sign_in({email: 'old@authwall.test', password: 'pass123'});

        // Connect Google
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {
            sub: 'google-sub-123',
            name: 'Test User',
            picture: null,
            email: null,
            email_verified: false,
        });
        await this.client.get_json_no_redirects('/auth/google?connect=1');
        const sess = await this.client.get_session();
        await this.client.get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));

        const status1 = await this.client.get_json('/auth/status');
        assert.ok(status1.providers.find(v => v.type === 'oauth_google'));

        // Request email change
        await this.client.post_json(config.pages.email_change_request, {
            email: 'new@authwall.test',
            _csrf: status1.csrf_token,
        });
        const change_email = this.sent_emails.find(e => e.placeholders?.token && e.to === 'new@authwall.test');
        assert.ok(change_email, 'email change confirmation email should be sent');
        const token = change_email.placeholders.token;

        // Confirm email change
        await this.client.get_json(urlmod(config.pages.email_change_confirm, {token}));

        // Old email sign-in must now fail
        await this.client.post_json('/auth/sign-out', {_csrf: (await this.client.get_json('/auth/status')).csrf_token});
        const s = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'old@authwall.test', password: 'pass123', _csrf: s.csrf_token});
        const after_old = await this.client.get_json('/auth/status');
        assert.strictEqual(after_old.authenticated, false);
        assert.strictEqual(after_old.error, 'Invalid username or password');

        // Google sign-in must still work
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {
            sub: 'google-sub-123',
            name: 'Test User',
            picture: null,
            email: null,
            email_verified: false,
        });
        await this.client.get_json_no_redirects('/auth/google');
        const sess2 = await this.client.get_session();
        await this.client.get_json(urlmod('/auth/google/callback', {state: sess2.oauth_state, code: 'fake_code'}));

        const after_google = await this.client.get_json('/auth/status');
        assert.strictEqual(after_google.error, null);
        assert.strictEqual(after_google.authenticated, true);
    });

});
