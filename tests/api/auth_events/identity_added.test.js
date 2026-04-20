const assert = require('assert');
const config = require('../../../config');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const mock_github = require('../../mock_github');
const mock_google = require('../../mock_google');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const users_create = require('../../../src/helpers/models/users_create');

describe('auth_events • identity_added', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.github.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    it('should be recorded when GitHub identity is connected', async function () {
        mock_github();
        await this.sign_in({username: 'mocha', password: 'pass123'});

        await this.client.get_json_no_redirects('/auth/github?connect=1');
        const sess = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/github/callback', {code: '4/fake_code', state: sess.oauth_state}));

        const events = await db('auth_events').where({event_type: const_auth_event.identity_added}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_added,
            event_status: 'success',
            identity_type: const_user_identity.oauth_github,
            identity_value_normalized: 'github-user-123',
        });
    });

    it('should be recorded when Google identity is connected', async function () {
        mock_google();
        await this.sign_in({username: 'mocha', password: 'pass123'});

        await this.client.get_json_no_redirects('/auth/google?connect=1');
        const sess = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, iss: 'https://accounts.google.com', code: '4/fake_code', scope: 'email profile openid', authuser: '0', prompt: 'none'}));

        const events = await db('auth_events').where({event_type: const_auth_event.identity_added}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_added,
            event_status: 'success',
            identity_type: const_user_identity.oauth_google,
            identity_value_normalized: 'google-user-123',
        });
    });

    it('should be recorded as noop when GitHub identity is already connected', async function () {
        mock_github();

        const {user_id} = await this.sign_in({username: 'mocha', password: 'pass123'});
        const now = new Date();
        await db('user_identities').insert({uid: random_uid_user_identity(), user_id, type: const_user_identity.oauth_github, value: 'github-user-123', value_normalized: 'github-user-123', created_at: now, updated_at: now, verified_at: now});

        await this.client.get_json_no_redirects('/auth/github?connect=1');
        const sess = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/github/callback', {code: '4/fake_code', state: sess.oauth_state}));

        const events = await db('auth_events').where({event_type: const_auth_event.identity_added}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_added,
            event_status: 'noop',
            identity_type: const_user_identity.oauth_github,
            identity_value_normalized: 'github-user-123',
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'already_connected'});
    });

    it('should be recorded as noop when Google identity is already connected', async function () {
        mock_google();

        const {user_id} = await this.sign_in({username: 'mocha', password: 'pass123'});
        const now = new Date();
        await db('user_identities').insert({uid: random_uid_user_identity(), user_id, type: const_user_identity.oauth_google, value: 'google-user-123', value_normalized: 'google-user-123', created_at: now, updated_at: now, verified_at: now});

        await this.client.get_json_no_redirects('/auth/google?connect=1');
        const sess = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, iss: 'https://accounts.google.com', code: '4/fake_code', scope: 'email profile openid', authuser: '0', prompt: 'none'}));

        const events = await db('auth_events').where({event_type: const_auth_event.identity_added}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_added,
            event_status: 'noop',
            identity_type: const_user_identity.oauth_google,
            identity_value_normalized: 'google-user-123',
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'already_connected'});
    });

    it('should be recorded as failure when GitHub identity belongs to another user', async function () {
        mock_github();

        // User A has github-user-123
        await db.transaction(async function () {
            const now = new Date();
            const user = await users_create();
            await db('user_identities').insert({uid: random_uid_user_identity(), user_id: user.id, type: const_user_identity.oauth_github, value: 'github-user-123', value_normalized: 'github-user-123', created_at: now, updated_at: now, verified_at: now});
        });

        // User B is signed in and tries to connect the same GitHub
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.client.get_json_no_redirects('/auth/github?connect=1');
        const sess = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/github/callback', {code: '4/fake_code', state: sess.oauth_state}));

        const events = await db('auth_events').where({event_type: const_auth_event.identity_added}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_added,
            event_status: 'failure',
            identity_type: const_user_identity.oauth_github,
            identity_value_normalized: 'github-user-123',
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'linked_to_another_user'});
    });

    it('should be recorded as failure when Google identity belongs to another user', async function () {
        mock_google();

        // User A has google-user-123
        await db.transaction(async function () {
            const now = new Date();
            const user = await users_create();
            await db('user_identities').insert({uid: random_uid_user_identity(), user_id: user.id, type: const_user_identity.oauth_google, value: 'google-user-123', value_normalized: 'google-user-123', created_at: now, updated_at: now, verified_at: now});
        });

        // User B is signed in and tries to connect the same Google
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.client.get_json_no_redirects('/auth/google?connect=1');
        const sess = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, iss: 'https://accounts.google.com', code: '4/fake_code', scope: 'email profile openid', authuser: '0', prompt: 'none'}));

        const events = await db('auth_events').where({event_type: const_auth_event.identity_added}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_added,
            event_status: 'failure',
            identity_type: const_user_identity.oauth_google,
            identity_value_normalized: 'google-user-123',
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'linked_to_another_user'});
    });

});
