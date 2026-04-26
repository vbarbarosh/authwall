const assert = require('assert');
const config = require('../../../config');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');

describe('auth_events • identity_removed', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.github.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    it('should be recorded when GitHub identity is disconnected', async function () {
        await db('auth_events').del();

        const {user_id} = await this.sign_in({username: 'mocha', password: 'pass123'});

        const now = new Date();
        await db('user_identities').insert([
            {uid: random_uid_user_identity(), user_id, type: const_user_identity.oauth_github, value: 'github-user-123', value_normalized: 'github-user-123', created_at: now, updated_at: now, verified_at: now},
        ]);

        await this.http_post_json('/auth/github/disconnect');

        const events = await db('auth_events').where({event_type: const_auth_event.identity_removed}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_removed,
            event_status: 'success',
            identity_type: const_user_identity.oauth_github,
            identity_value_normalized: 'github-user-123',
        });
    });

    it('should be recorded when Google identity is disconnected', async function () {
        await db('auth_events').del();

        const {user_id} = await this.sign_in({username: 'mocha', password: 'pass123'});

        const now = new Date();
        await db('user_identities').insert([
            {uid: random_uid_user_identity(), user_id: user_id, type: const_user_identity.oauth_google, value: 'google-user-123', value_normalized: 'google-user-123', created_at: now, updated_at: now, verified_at: now},
        ]);

        await this.http_post_json('/auth/google/disconnect');

        const events = await db('auth_events').where({event_type: const_auth_event.identity_removed}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_removed,
            event_status: 'success',
            identity_type: const_user_identity.oauth_google,
            identity_value_normalized: 'google-user-123',
        });
    });

    it('should be recorded when email identity is removed', async function () {
        await db('auth_events').del();

        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/email/remove');

        const events = await db('auth_events').where({event_type: const_auth_event.identity_removed}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_removed,
            event_status: 'success',
            identity_type: const_user_identity.email,
            identity_value_normalized: 'mocha@authwall.test',
        });
    });

    it('should be recorded as failure when GitHub is the last identity', async function () {
        await db('auth_events').del();

        const {user_id} = await this.sign_in({username: 'mocha', password: 'pass123'});

        const now = new Date();
        await db('user_identities').where({user_id}).del();
        await db('user_identities').insert([
            {uid: random_uid_user_identity(), user_id: user_id, type: const_user_identity.oauth_github, value: 'github-user-123', value_normalized: 'github-user-123', created_at: now, updated_at: now, verified_at: now}
        ]);

        await this.http_post_json('/auth/github/disconnect');

        const events = await db('auth_events').where({event_type: const_auth_event.identity_removed}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_removed,
            event_status: 'failure',
            identity_type: const_user_identity.oauth_github,
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'last_identity'});
    });

    it('should be recorded as failure when Google is the last identity', async function () {
        await db('auth_events').del();

        const {user_id} = await this.sign_in({username: 'mocha', password: 'pass123'});

        const now = new Date();
        await db('user_identities').where({user_id}).del();
        await db('user_identities').insert([
            {uid: random_uid_user_identity(), user_id, type: const_user_identity.oauth_google, value: 'google-user-123', value_normalized: 'google-user-123', created_at: now, updated_at: now, verified_at: now},
        ]);

        await this.http_post_json('/auth/google/disconnect');

        const events = await db('auth_events').where({event_type: const_auth_event.identity_removed}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_removed,
            event_status: 'failure',
            identity_type: const_user_identity.oauth_google,
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'last_identity'});
    });

    it('should be recorded as failure when email is the last identity', async function () {
        await db('auth_events').del();

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/email/remove');

        const events = await db('auth_events').where({event_type: const_auth_event.identity_removed}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_removed,
            event_status: 'failure',
            identity_type: const_user_identity.email,
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'last_identity'});
    });

    it('should be recorded as noop when GitHub is not connected', async function () {
        await db('auth_events').del();
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/github/disconnect', {});

        const events = await db('auth_events').where({event_type: const_auth_event.identity_removed}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_removed,
            event_status: 'noop',
            identity_type: const_user_identity.oauth_github,
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'not_connected'});
    });

    it('should be recorded as noop when Google is not connected', async function () {
        await db('auth_events').del();
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/google/disconnect', {});

        const events = await db('auth_events').where({event_type: const_auth_event.identity_removed}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_removed,
            event_status: 'noop',
            identity_type: const_user_identity.oauth_google,
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'not_connected'});
    });

    it('should be recorded as noop when email is not connected', async function () {
        await db('auth_events').del();
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/email/remove', {});

        const events = await db('auth_events').where({event_type: const_auth_event.identity_removed}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.identity_removed,
            event_status: 'noop',
            identity_type: const_user_identity.email,
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {reason: 'not_connected'});
    });

});
