const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');
const fs_path_join = require('@vbarbarosh/node-helpers/src/fs_path_join');
const fs_readdir = require('@vbarbarosh/node-helpers/src/fs_readdir');

describe('emails coverage', function () {

    it('has a dedicated test file for each email type', async function () {
        const files = new Set(await fs_readdir(__dirname));
        for (const email_type of Object.values(const_email)) {
            const test_file = `${email_type}.test.js`;
            assert.ok(files.has(test_file), `Missing ${fs_path_join('tests/api/emails', `${test_file}`)}`);
        }
    });

});
