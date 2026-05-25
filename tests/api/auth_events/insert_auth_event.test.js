const assert = require('assert');
const db = require('../../../db');
const insert_auth_event = require('../../../src/helpers/insert_auth_event');
const users_create = require('../../../src/helpers/models/users_create');

describe('insert_auth_event • user_id resolution', function () {

    it('uses params.user.id when explicitly passed', async function () {
        const user = await users_create();
        const other = await users_create();
        const req = {
            session: {user_id: other.id},
            auth: {user_id: other.id},
            ip: '127.0.0.1',
            headers: {},
        };

        const uid = await insert_auth_event({
            req,
            user,
            event_type: 'identity_added',
        });

        const row = await db('auth_events').where({uid}).first();
        assert.strictEqual(row.user_id, user.id);
    });

    it('uses req.auth.user_id when no session is present (bearer-authenticated request)', async function () {
        const user = await users_create();
        const req = {
            session: {},
            auth: {user_id: user.id, user_uid: user.uid, personal_access_token_uid: 'awpat_test'},
            ip: '127.0.0.1',
            headers: {},
        };

        const uid = await insert_auth_event({
            req,
            event_type: 'identity_added',
        });

        const row = await db('auth_events').where({uid}).first();
        assert.strictEqual(row.user_id, user.id);
    });

    it('falls back to req.session.user_id when only a cookie session is present', async function () {
        const user = await users_create();
        const req = {
            session: {user_id: user.id},
            ip: '127.0.0.1',
            headers: {},
        };

        const uid = await insert_auth_event({
            req,
            event_type: 'identity_added',
        });

        const row = await db('auth_events').where({uid}).first();
        assert.strictEqual(row.user_id, user.id);
    });

    it('records user_id NULL when no identity is available', async function () {
        const req = {
            session: {},
            ip: '127.0.0.1',
            headers: {},
        };

        const uid = await insert_auth_event({
            req,
            event_type: 'identity_added',
        });

        const row = await db('auth_events').where({uid}).first();
        assert.strictEqual(row.user_id, null);
    });

});
