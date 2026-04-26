const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('auth_events • profile_updated', function () {

    it('should be recorded when display name is updated from profile', async function () {
        await db('auth_events').del();
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/profile', {display_name: 'Mocha 123'});

        const events = await db('auth_events').where({event_type: const_auth_event.profile_updated}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.profile_updated,
            event_status: 'success',
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {fields: ['display_name']});
    });

});
