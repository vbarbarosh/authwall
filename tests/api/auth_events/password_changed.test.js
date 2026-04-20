const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('auth_events • password_changed', function () {

    it('should be recorded when password is changed from profile', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/change-password', {current_password: 'pass123', password: 'newpass123', password_confirm: 'newpass123'});

        const events = await db('auth_events').where({event_type: const_auth_event.password_changed}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.password_changed,
            event_status: 'success',
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {method: 'profile'});
    });

});
