const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('POST /auth/account/remove', function () {

    it('requires authentication', async function () {
        await this.http_post_json('/auth/account/remove', {confirmation: 'DELETE'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Authentication required');
        assert.strictEqual(status.authenticated, false);
    });

    it('requires typed confirmation', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/account/remove', {confirmation: 'delete'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Type DELETE to remove account');
        assert.strictEqual(status.authenticated, true);
    });

    it('removes the user, dependent records, and all sessions while keeping dereferenced auth events', async function () {
        await db('auth_events').del();

        const {user_id} = await this.add_user({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        const now = new Date();

        await db('password_reset_tokens').insert({
            user_id,
            token_hash: 'account-remove-password-reset-token',
            created_at: now,
            updated_at: now,
            expires_at: now,
        });
        await db('email_verify_tokens').insert({
            user_id,
            email_normalized: 'mocha@authwall.test',
            token_hash: 'account-remove-email-verify-token',
            created_at: now,
            updated_at: now,
            expires_at: now,
        });
        await db('email_change_tokens').insert({
            user_id,
            email_normalized: 'new-mocha@authwall.test',
            token_hash: 'account-remove-email-change-token',
            created_at: now,
            updated_at: now,
            expires_at: now,
        });
        await db('personal_access_tokens').insert({
            uid: 'awpat_account_remove_token',
            user_id,
            label: 'Account remove token',
            token_hash: 'account-remove-personal-access-token-hash',
            token_prefix: 'awp_account_rem',
            created_at: now,
            updated_at: now,
        });

        const cookies_a = new Map();
        const cookies_b = new Map();

        this.client.cookies = cookies_a;
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});
        const signed_in_status = await this.http_get_json('/auth/status');
        const user_uid = signed_in_status.user_uid;

        this.client.cookies = cookies_b;
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});

        const sign_in_events_before = await db('auth_events').where({event_type: const_auth_event.sign_in, user_id}).orderBy('id');
        assert.strictEqual(sign_in_events_before.length, 2);
        const sign_in_event_uids = sign_in_events_before.map(v => v.uid);

        this.client.cookies = cookies_a;
        await this.http_post_json('/auth/account/remove', {confirmation: 'DELETE'});

        const status_a = await this.http_get_json('/auth/status');
        assert.strictEqual(status_a.authenticated, false);

        this.client.cookies = cookies_b;
        const status_b = await this.http_get_json('/auth/status');
        assert.strictEqual(status_b.authenticated, false);

        assert.deepStrictEqual(await db('users').where({id: user_id}).count('* as c'), [{c: 0}]);
        assert.deepStrictEqual(await db('user_identities').where({user_id}).count('* as c'), [{c: 0}]);
        assert.deepStrictEqual(await db('sessions').where({user_id}).count('* as c'), [{c: 0}]);
        assert.deepStrictEqual(await db('password_reset_tokens').where({user_id}).count('* as c'), [{c: 0}]);
        assert.deepStrictEqual(await db('email_verify_tokens').where({user_id}).count('* as c'), [{c: 0}]);
        assert.deepStrictEqual(await db('email_change_tokens').where({user_id}).count('* as c'), [{c: 0}]);
        assert.deepStrictEqual(await db('personal_access_tokens').where({user_id}).count('* as c'), [{c: 0}]);

        const events_for_deleted_user = await db('auth_events').where({user_id});
        assert.deepStrictEqual(events_for_deleted_user, []);

        const sign_in_events = await db('auth_events').whereIn('uid', sign_in_event_uids).orderBy('id');
        assert.strictEqual(sign_in_events.length, 2);
        assert.ok(sign_in_events.every(v => v.user_id === null));

        const removed_events = await db('auth_events').where({event_type: const_auth_event.account_removed}).orderBy('id');
        assert.strictEqual(removed_events.length, 1);
        assert.partialDeepStrictEqual(removed_events[0], {
            event_type: const_auth_event.account_removed,
            event_status: 'success',
            user_id: null,
            identity_value: user_uid,
            identity_value_normalized: user_uid,
        });
    });

});
