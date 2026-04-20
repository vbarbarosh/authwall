const assert = require('assert');
const config = require('../../../config');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const mock_github = require('../../mock_github');
const mock_google = require('../../mock_google');
const normalize_email = require('../../../src/helpers/normalize/normalize_email');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const users_create = require('../../../src/helpers/models/users_create');

describe('auth_events • sign_in', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.github.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    it('should be recorded on successful sign-in via username and password', async function () {
        const {user_id} = await this.sign_in({username: 'mocha', password: 'pass123'});

        const events = await db('auth_events').where({event_type: const_auth_event.sign_in, user_id}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.sign_in,
            event_status: 'success',
            identity_type: const_user_identity.username,
            identity_value_normalized: 'mocha',
        });
    });

    it('should be recorded on successful sign-in via email and password', async function () {
        const {user_id} = await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});

        const events = await db('auth_events').where({event_type: const_auth_event.sign_in, user_id}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.sign_in,
            event_status: 'success',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('mocha@authwall.test'),
        });
    });

    it('should be recorded on successful sign-in via magic link', async function () {
        await db('auth_events').del();

        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});

        await this.http_get_json(this.sent_emails[0].placeholders.link);

        const events = await db('auth_events').orderBy('id');
        const sign_in_event = events.find(v => v.event_type === const_auth_event.sign_in);
        assert.ok(sign_in_event);
        assert.partialDeepStrictEqual(sign_in_event, {
            event_status: 'success',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('mocha@authwall.test'),
        });
    });

    it('should be recorded on successful sign-in via magic code', async function () {
        await db('auth_events').del();

        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: this.sent_emails[0].placeholders.code});

        const events = await db('auth_events').orderBy('id');
        const sign_in_event = events.find(v => v.event_type === const_auth_event.sign_in);
        assert.ok(sign_in_event);
        assert.partialDeepStrictEqual(sign_in_event, {
            event_status: 'success',
            identity_type: const_user_identity.email,
            identity_value_normalized: normalize_email('mocha@authwall.test'),
        });
    });

    it('should be recorded on successful sign-in via Google', async function () {

        await db('auth_events').del();

        mock_google();

        await db.transaction(async function () {
            const now = new Date();
            const user = await users_create();
            await db('user_identities').insert([
                {uid: random_uid_user_identity(), user_id: user.id, type: const_user_identity.oauth_google, value: 'google-user-123', value_normalized: 'google-user-123', created_at: now, updated_at: now, verified_at: now},
                {uid: random_uid_user_identity(), user_id: user.id, type: const_user_identity.email, value: 'test@example.com', value_normalized: normalize_email('test@example.com'), created_at: now, updated_at: now, verified_at: now},
            ]);
        });

        await this.client.get_json_no_redirects('/auth/google');
        const sess = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/google/callback', {
            state: sess.oauth_state,
            iss: 'https://accounts.google.com',
            code: '4/fake_code',
            scope: 'email profile openid',
            authuser: '0',
            prompt: 'none'
        }));

        const events = await db('auth_events').orderBy('id');
        const sign_in_event = events.find(v => v.event_type === const_auth_event.sign_in);
        assert.ok(sign_in_event);
        assert.partialDeepStrictEqual(sign_in_event, {
            event_status: 'success',
            identity_type: const_user_identity.oauth_google,
            identity_value_normalized: 'google-user-123',
        });
    });

    it('should be recorded on successful sign-in via GitHub', async function () {
        await db('auth_events').del();
        mock_github();

        await db.transaction(async function () {
            const now = new Date();
            const user = await users_create();
            await db('user_identities').insert([
                {uid: random_uid_user_identity(), user_id: user.id, type: const_user_identity.oauth_github, value: 'github-user-123', value_normalized: 'github-user-123', created_at: now, updated_at: now, verified_at: now},
                {uid: random_uid_user_identity(), user_id: user.id, type: const_user_identity.email, value: 'jack@domain1.com', value_normalized: normalize_email('jack@domain1.com'), created_at: now, updated_at: now, verified_at: now},
            ]);
        });

        await this.client.get_json_no_redirects('/auth/github');
        const sess = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/github/callback', {code: '4/fake_code', state: sess.oauth_state}));

        const events = await db('auth_events').orderBy('id');
        const sign_in_event = events.find(v => v.event_type === const_auth_event.sign_in);
        assert.ok(sign_in_event);
        assert.partialDeepStrictEqual(sign_in_event, {
            event_status: 'success',
            identity_type: const_user_identity.oauth_github,
            identity_value_normalized: 'github-user-123',
        });
    });

    it('should be recorded as failure on wrong password', async function () {
        await db('auth_events').del();
        await this.add_user({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'wrong'});

        const events = await db('auth_events').orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.sign_in,
            event_status: 'failure',
            identity_type: const_user_identity.username,
            identity_value_normalized: 'mocha',
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'invalid_password'});
    });

    it('should be recorded as failure when user not found', async function () {
        await db('auth_events').del();
        await this.http_post_json('/auth/sign-in', {username: 'ghost', password: 'pass123'});

        const events = await db('auth_events').orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.sign_in,
            event_status: 'failure',
            identity_type: const_user_identity.username,
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'user_not_found'});
    });

});
