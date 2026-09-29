const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('auth_events • identity_confirmed', function () {

    it('should be recorded for a wrong and then a right password', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/confirm', {password: 'wrong'});
        await this.http_post_json('/auth/confirm', {password: 'pass123'});

        const events = await db('auth_events').where({event_type: const_auth_event.identity_confirmed}).orderBy('id');
        assert.deepStrictEqual(events.map(v => [v.event_status, JSON.parse(v.custom)]), [
            ['failure', {method: 'password'}],
            ['success', {method: 'password'}],
        ]);
    });

});
