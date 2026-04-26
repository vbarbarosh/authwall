const assert = require('assert');
const config = require('../../../config');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

describe('auth_events • avatar_updated', function () {

    it('should be recorded when avatar is updated from profile', async function () {
        await db('auth_events').del();
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        await this.client.post_multipart('/auth/profile', {
            _csrf: status.csrf_token,
            avatar: {
                path: `${__dirname}/../../../logo.png`,
                filename: 'avatar.png',
                contentType: 'image/png',
            },
        });

        const events = await db('auth_events').where({event_type: const_auth_event.avatar_updated}).orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.avatar_updated,
            event_status: 'success',
        });
        assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {
            avatar_url: `${config.public_url}/auth/uploads/${status.user_slug}/avatar.webp`,
        });
    });

});
