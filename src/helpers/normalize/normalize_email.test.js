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

describe('normalize_email shape', function () {

    it('rejects values that are not a single address', function () {
        const crlf = String.fromCharCode(13, 10);
        for (const v of ['foo', '@x.test', 'a@', 'a@b@c', 'a b@x.test', 'a,b@x.test', 'a@x.test, c@y.test', 'a@x.test,', '<img src=x>@x.test', '"a"@x.test', 'a@[1.2.3.4]', 'a@x.test' + crlf + 'Bcc: c@y.test', 'a'.repeat(65) + '@x.test']) {
            assert.strictEqual(normalize_email(v), null, JSON.stringify(v));
        }
    });

    it('accepts ordinary addresses', function () {
        for (const v of ['a@b', 'first.last+tag@sub.example.co.uk', 'x_y-z@localhost', 'üser@exämple.de']) {
            assert.strictEqual(normalize_email(v), v);
        }
    });

});
