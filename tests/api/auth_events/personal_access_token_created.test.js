const assert = require('assert');
const config = require('../../../config');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('auth_events • personal_access_token_created', function () {

    beforeEach(function () {
        config.personal_access_tokens.enabled = true;
    });

    it('should be recorded when a personal access token is created', async function () {
        await db('auth_events').del();
        await this.sign_in({username: 'mocha', password: 'pass123'});

        const created = await this.http_post_json('/auth/personal-access-tokens', {
            label: 'CLI',
        });

        const events = await db('auth_events').where({event_type: const_auth_event.personal_access_token_created}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.personal_access_token_created,
            event_status: 'success',
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {
            personal_access_token_uid: created.personal_access_token.uid,
            label: 'CLI',
        });
    });

});
