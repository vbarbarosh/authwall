const assert = require('assert');
const bcrypt = require('bcrypt');
const bootstrap_users = require('../../src/helpers/bootstrap_users');
const config = require('../../config');
const fs = require('fs');
const os = require('os');
const parse_authwall_seed_file = require('../../src/helpers/parse/parse_authwall_seed_file');
const path = require('path');

describe('bootstrap_users', function () {

    it('does not write the password of a rejected seed to the log', async function () {
        config.seed_users = [{username: '<bad>', password: 'hunter2-plain', password_hash: '$2b$12$hash', email: []}];

        await bootstrap_users();

        const logs = this.written_logs.join('\n');
        assert.ok(logs.includes('Skipping invalid user seed'));
        assert.strictEqual(logs.includes('hunter2-plain'), false);
        assert.strictEqual(logs.includes('$2b$12$hash'), false);
        assert.ok(logs.includes('[Filtered]'));
    });

    it('seeds the users of AUTHWALL_SEED_FILE, who sign in with the password behind the hash', async function () {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-file-'));
        await using _ = {[Symbol.asyncDispose]: () => fs.promises.rm(dir, {recursive: true, force: true})};
        const file = path.join(dir, 'users.csv');
        fs.writeFileSync(file, `username,emails,password_hash\nalice,,${await bcrypt.hash('alice-pass-1', 4)}\n`);
        config.seed_users = parse_authwall_seed_file(file);

        await bootstrap_users();
        await this.http_post_json('/auth/sign-in', {username: 'alice', password: 'alice-pass-1'});

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);
        assert.strictEqual(this.written_logs.join('\n').includes('alice-pass-1'), false);
    });

});
