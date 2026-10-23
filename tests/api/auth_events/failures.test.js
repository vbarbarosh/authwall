const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');
const insert_auth_event = require('../../../src/helpers/insert_auth_event');
const users_create = require('../../../src/helpers/models/users_create');

describe('auth_events • rejected requests', function () {
    it('bounds attacker-controlled fields to the database column sizes', async function () {
        const user = await users_create();
        const req = {session: {user_id: user.id}, headers: {'user-agent': 'x'.repeat(4096)}, ip: 'x'.repeat(128)};
        const uid = await insert_auth_event({req, user: null, event_type: const_auth_event.sign_in, ident: {value: '😀'.repeat(300), value_normalized: 'x'.repeat(300)}});
        const event = await db('auth_events').where({uid}).first();
        assert.strictEqual(event.user_id, null);
        assert.strictEqual(event.ua.length, 512);
        assert.strictEqual(event.ip.length, 64);
        assert.strictEqual(Array.from(event.identity_value).length, 255);
        assert.strictEqual(event.identity_value_normalized.length, 255);
    });
});
