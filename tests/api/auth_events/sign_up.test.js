const assert = require('assert');
const config = require('../../../config');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const mock_github = require('../../mock_github');
const mock_google = require('../../mock_google');
const normalize_email = require('../../../src/helpers/normalize/normalize_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('auth_events • sign_up', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.github.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    it('should be recorded on sign-up via username', async function () {
        config.flows.password.min_password_length = 4;
        await db('auth_events').del();

        await this.http_post_json('/auth/sign-up', {username: 'mocha', password: 'pass123', password_confirm: 'pass123'});

        const events = await db('auth_events').orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.sign_up,
            event_status: 'success',
            identity_type: const_user_identity.username,
            identity_value_normalized: 'mocha',
        });
    });

    it('should be recorded on sign-up via email', async function () {
        config.flows.password.min_password_length = 4;
        await db('auth_events').del();

        await this.http_post_json('/auth/sign-up', {email: 'mocha@authwall.test', password: 'pass123', password_confirm: 'pass123'});
        await this.wait_for_emails(1);

        const events = await db('auth_events').orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.sign_up,
            event_status: 'success',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('mocha@authwall.test'),
        });
    });

    it('should be recorded on sign-up via magic link', async function () {
        await db('auth_events').del();

        await this.http_post_json('/auth/magic-link/request', {email: 'newuser@authwall.test'});
        await this.http_get_json(this.sent_emails[0].placeholders.link);

        const events = await db('auth_events').where({event_type: const_auth_event.sign_up}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_status: 'success',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('newuser@authwall.test'),
        });
    });

    it('should be recorded on sign-up via magic code', async function () {
        await db('auth_events').del();

        await this.http_post_json('/auth/magic-link/request', {email: 'newuser@authwall.test'});
        await this.http_post_json('/auth/magic-link/confirm', {email: 'newuser@authwall.test', code: this.sent_emails[0].placeholders.code});

        const events = await db('auth_events').where({event_type: const_auth_event.sign_up}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_status: 'success',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('newuser@authwall.test'),
        });
    });

    it('should be recorded on sign-up via Google', async function () {
        await db('auth_events').del();
        mock_google();

        await this.client.get_json_no_redirects('/auth/google');
        const sess = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, iss: 'https://accounts.google.com', code: '4/fake_code', scope: 'email profile openid', authuser: '0', prompt: 'none'}));

        const events = await db('auth_events').where({event_type: const_auth_event.sign_up}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_status: 'success',
            identity_type: const_user_identity.oauth_google,
            identity_value_normalized: 'google-user-123',
        });
    });

    it('should be recorded on sign-up via GitHub', async function () {
        await db('auth_events').del();
        mock_github();

        await this.client.get_json_no_redirects('/auth/github');
        const sess = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/github/callback', {code: '4/fake_code', state: sess.oauth_state}));

        const events = await db('auth_events').where({event_type: const_auth_event.sign_up}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_status: 'success',
            identity_type: const_user_identity.oauth_github,
            identity_value_normalized: 'github-user-123',
        });
    });

});
