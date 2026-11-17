const assert = require('assert');
const fs = require('fs');
const os = require('os');
const parse_authwall_seed_file = require('./parse_authwall_seed_file');
const path = require('path');

const HASH = '$2b$12$HjdTGILq./Cak9R9pTQqxODQSkmuS.vnOWVpQxo14R0tSQiqGBE0G';
const BOM = String.fromCharCode(0xFEFF);

describe('parse_authwall_seed_file', function () {

    let dir = null;

    beforeEach(function () {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-file-'));
    });

    afterEach(function () {
        fs.rmSync(dir, {recursive: true, force: true});
    });

    function write(name, text) {
        const file = path.join(dir, name);
        fs.writeFileSync(file, text);
        return file;
    }

    it('reads nothing without a file', function () {
        assert.deepStrictEqual(parse_authwall_seed_file(null), []);
    });

    it('reads a CSV by the columns its header names', function () {
        const file = write('users.csv', `${BOM}username,emails,display_name,password_hash\r\nalice,"alice@myapp.test, a@myapp.test",Alice,${HASH}\r\n\r\nbob,,,\r\n`);
        assert.deepStrictEqual(parse_authwall_seed_file(file), [
            {username: 'alice', password_hash: HASH, display_name: 'Alice', email: ['alice@myapp.test', 'a@myapp.test']},
            {username: 'bob', password_hash: undefined, display_name: undefined, email: []},
        ]);
    });

    it('reads a JSON array', function () {
        const file = write('users.json', JSON.stringify([{username: 'alice', emails: ['alice@myapp.test'], password_hash: HASH}]));
        assert.deepStrictEqual(parse_authwall_seed_file(file), [
            {username: 'alice', password_hash: HASH, display_name: undefined, email: ['alice@myapp.test']},
        ]);
    });

    it('refuses a CSV header without a required column', function () {
        const file = write('users.csv', `username,password_hash\nalice,${HASH}\n`);
        assert.throws(() => parse_authwall_seed_file(file), /the header row names username, emails and password_hash, .*missing: emails/);
    });

    it('refuses a CSV header with an unknown column', function () {
        const file = write('users.csv', `username,emails,pasword_hash\nalice,,${HASH}\n`);
        assert.throws(() => parse_authwall_seed_file(file), /unknown: pasword_hash; missing: password_hash/);
    });

    it('refuses a CSV with no header row, its first line kept out of the message', function () {
        const file = write('users.csv', `alice,alice@myapp.test,${HASH}\n`);
        assert.throws(() => parse_authwall_seed_file(file), function (error) {
            assert.match(error.message, /the first line names no known column; a CSV opens with a header row/);
            assert.strictEqual(error.message.includes(HASH), false);
            return true;
        });
    });

    it('refuses a plain password', function () {
        const csv = write('users.csv', 'username,emails,password\nalice,,alice-pass-1\n');
        assert.throws(() => parse_authwall_seed_file(csv), /the header names "password"; .*bin\/password-hash/);
        const json = write('users.json', JSON.stringify([{username: 'alice', password: 'alice-pass-1'}]));
        assert.throws(() => parse_authwall_seed_file(json), /user 1: "password" is never kept in the file; .*bin\/password-hash/);
    });

    it('tells where a broken file fails, never what it holds', function () {
        const json = write('users.json', '[{"username": "alice", "password_hash": "alice-pass-1"');
        assert.throws(() => parse_authwall_seed_file(json), v => (v.message.endsWith(': not valid JSON') && !v.message.includes('alice-pass-1')));
        const csv = write('users.csv', 'username,emails,password_hash\n"alice-pass-1,,x\n');
        assert.throws(() => parse_authwall_seed_file(csv), v => (/does not parse at line 2 \(CSV_QUOTE_NOT_CLOSED\)$/.test(v.message) && !v.message.includes('alice-pass-1')));
    });

    it('refuses a password_hash that is not a bcrypt hash', function () {
        const file = write('users.json', JSON.stringify([{username: 'alice', password_hash: 'alice-pass-1'}]));
        assert.throws(() => parse_authwall_seed_file(file), /user 1: "password_hash" is not a bcrypt hash/);
    });

});
