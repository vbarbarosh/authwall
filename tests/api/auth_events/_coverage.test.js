const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const fs_path_join = require('@vbarbarosh/node-helpers/src/fs_path_join');
const fs_readdir = require('@vbarbarosh/node-helpers/src/fs_readdir');

describe('auth_events coverage', function () {

    it('has a dedicated test file for each auth event type', async function () {
        const files = new Set(await fs_readdir(__dirname));
        for (const event_type of Object.values(const_auth_event)) {
            const test_file = `${event_type}.test.js`;
            assert.ok(files.has(test_file), `Missing ${fs_path_join('tests/api/auth_events', `${test_file}`)}`);
        }
    });

});
