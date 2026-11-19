const assert = require('assert');
const child_process = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');

// See a_broken_seed_never_prints_itself.md.
describe('A broken seed never prints itself | stories', function () {

    this.timeout(30000);

    // Loads the configuration, as the start does first, with this seed.
    function load_config(seed) {
        return child_process.spawnSync(process.execPath, ['-e', 'require("./config")'], {
            cwd: ROOT,
            env: {...process.env, AUTHWALL_SEED: seed, AUTHWALL_SEED_FILE: ''},
            encoding: 'utf8',
        });
    }

    it('stops the start and prints no part of the seed (AW-127)', function () {
        for (const [seed, message] of [
            ['[{"username":"admin","password":"Winter-PASSWORD-1" "emails":["admin@example.com"]}]', 'AUTHWALL_SEED: not valid JSON'],
            ['[["admin","Winter-PASSWORD-1"]]', 'AUTHWALL_SEED: a JSON seed is an array of objects'],
        ]) {
            const run = load_config(seed);
            const output = run.stdout + run.stderr;
            assert.notStrictEqual(run.status, 0, output);
            assert.ok(output.includes(message), output);
            assert.ok(!output.includes('PASSWORD'), output);
        }
    });

});
