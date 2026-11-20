const assert = require('assert');
const child_process = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');

// See a_header_typo_never_prints_its_value.md.
describe('A header typo never prints its value | stories', function () {

    this.timeout(30000);

    // Loads the configuration, as the start does first, with these headers.
    function load_config(set_headers) {
        return child_process.spawnSync(process.execPath, ['-e', 'require("./config")'], {
            cwd: ROOT,
            env: {...process.env, AUTHWALL_SET_HEADERS: set_headers},
            encoding: 'utf8',
        });
    }

    it('stops the start and prints no part of the entry (AW-173)', function () {
        for (const [set_headers, message] of [
            ['X-Team=notes;Authorization: Basic S3CRET', 'AUTHWALL_SET_HEADERS entry 2 must contain "=": Header-Name=value'],
            ['X-Team=notes;Authorization Basic S3CRET=', 'AUTHWALL_SET_HEADERS entry 2 must have a header name of letters, digits and -: Header-Name=value'],
        ]) {
            const run = load_config(set_headers);
            const output = run.stdout + run.stderr;
            assert.notStrictEqual(run.status, 0, output);
            assert.ok(output.includes(message), output);
            assert.ok(!output.includes('S3CRET'), output);
        }
    });

});
