const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('auth_events • identity_confirmation_requested', function () {

    it('should be recorded when a code is mailed to the primary address', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/confirm/request');

        const events = await db('auth_events').where({event_type: const_auth_event.identity_confirmation_requested}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_status: 'success',
            identity_type: 'email',
            identity_value_normalized: 'mocha@authwall.test',
        });
    });

});
