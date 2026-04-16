const assert = require('assert');
const normalize_email = require('./normalize_email');

describe('normalize_email', function () {

    it('lowercases and trims', function () {
        assert.strictEqual(normalize_email('  User@Example.COM  '), 'user@example.com');
    });

    it('returns null for empty input', function () {
        assert.strictEqual(normalize_email(''), null);
        assert.strictEqual(normalize_email(null), null);
        assert.strictEqual(normalize_email(undefined), null);
    });

    it('strips dots from gmail.com local part', function () {
        assert.strictEqual(normalize_email('john.doe@gmail.com'), 'johndoe@gmail.com');
        assert.strictEqual(normalize_email('j.o.h.n@gmail.com'), 'john@gmail.com');
        assert.strictEqual(normalize_email('johndoe@gmail.com'), 'johndoe@gmail.com');
    });

    it('strips dots from googlemail.com local part', function () {
        assert.strictEqual(normalize_email('john.doe@googlemail.com'), 'johndoe@googlemail.com');
    });

    it('does not strip dots for other domains', function () {
        assert.strictEqual(normalize_email('john.doe@example.com'), 'john.doe@example.com');
        assert.strictEqual(normalize_email('john.doe@outlook.com'), 'john.doe@outlook.com');
    });

});
