const assert = require('assert');
const normalize_username = require('./normalize_username');

describe('normalize_username', function () {

    it('trims and keeps ordinary usernames', function () {
        assert.strictEqual(normalize_username('  mocha  '), 'mocha');
        assert.strictEqual(normalize_username('John Doe'), 'John Doe');
        assert.strictEqual(normalize_username('user.name-01_x'), 'user.name-01_x');
    });

    it('returns null for empty input', function () {
        assert.strictEqual(normalize_username(''), null);
        assert.strictEqual(normalize_username('   '), null);
        assert.strictEqual(normalize_username(null), null);
        assert.strictEqual(normalize_username(undefined), null);
    });

    it('rejects markup, quotes, "@", control characters and over-long values', function () {
        const tab = String.fromCharCode(9);
        const newline = String.fromCharCode(10);
        for (const v of ['<img src=x onerror=alert(1)>', 'a>b', "it's", 'say "hi"', 'a&b', 'a@b', 'a' + tab + 'b', 'a' + newline + 'b', 'x'.repeat(65)]) {
            assert.strictEqual(normalize_username(v), null, JSON.stringify(v));
        }
    });

});
