const assert = require('assert');
const parse_authwall_seed = require('./parse_authwall_seed');

describe('parse_authwall_seed', function () {

    it('reads the compact form and the JSON form', function () {
        assert.deepStrictEqual(parse_authwall_seed('admin:pass-1:admin@myapp.test;ops:pass-2:'), [
            {username: 'admin', password: 'pass-1', email: ['admin@myapp.test']},
            {username: 'ops', password: 'pass-2', email: []},
        ]);
        assert.deepStrictEqual(parse_authwall_seed('[{"username":"admin","password":"pass-1","emails":"admin@myapp.test"}]'), [
            {username: 'admin', password: 'pass-1', display_name: undefined, email: ['admin@myapp.test']},
        ]);
    });

    // AW-127: an uncaught JSON.parse error printed the seed, passwords and all.
    it('refuses JSON that does not parse without quoting it', function () {
        const seed = '[{"username":"admin","password":"Winter-PASSWORD-1" "emails":[]}]';
        assert.throws(function () {
            parse_authwall_seed(seed);
        }, function (e) {
            assert.strictEqual(e.message, 'AUTHWALL_SEED: not valid JSON');
            assert.ok(!String(e.stack).includes('PASSWORD'), e.stack);
            return true;
        });
    });

    it('refuses a JSON seed that is not an array of objects', function () {
        for (const seed of ['[1, 2]', '[null]', '[["admin", "Winter-PASSWORD-1"]]']) {
            assert.throws(function () {
                parse_authwall_seed(seed);
            }, /^Error: AUTHWALL_SEED: a JSON seed is an array of objects$/, seed);
        }
    });

});
