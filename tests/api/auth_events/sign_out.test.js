const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('auth_events • sign_out', function () {

    it('should be recorded on sign-out', async function () {
        await db('auth_events').del();

        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/sign-out');

        const events = await db('auth_events').where({event_type: const_auth_event.sign_out}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.sign_out,
            event_status: 'success',
        });
    });

});
