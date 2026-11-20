const assert = require('assert');
const parse_set_headers = require('./parse_set_headers');

describe('parse_set_headers', function () {

    it('parses semicolon-separated key=value pairs', function () {
        assert.deepStrictEqual(parse_set_headers('X-Team=notes;X-Env=prod'), [
            {name: 'X-Team', value: 'notes'},
            {name: 'X-Env', value: 'prod'},
        ]);
    });

    it('allows empty values to mean an empty header value', function () {
        assert.deepStrictEqual(parse_set_headers('X-Foo=;X-Bar='), [
            {name: 'X-Foo', value: ''},
            {name: 'X-Bar', value: ''},
        ]);
    });

    it('splits on the first "=" only', function () {
        assert.deepStrictEqual(parse_set_headers('Authorization=Basic abc:def=='), [
            {name: 'Authorization', value: 'Basic abc:def=='},
        ]);
    });

    it('ignores empty segments and surrounding whitespace', function () {
        assert.deepStrictEqual(parse_set_headers(' ; X-Team = notes ; ; X-Env= prod ; '), [
            {name: 'X-Team', value: 'notes'},
            {name: 'X-Env', value: 'prod'},
        ]);
    });

    it('rejects entries without "="', function () {
        assert.throws(() => parse_set_headers('X-Team'), /must contain "="/);
    });

    it('rejects entries without a header name', function () {
        assert.throws(() => parse_set_headers('=notes'), /must have a header name/);
    });

    // AW-173: a typo printed the whole entry, the upstream's credential in it.
    it('names a wrong entry by its number, never its text', function () {
        for (const [value, message] of [
            ['X-Team=notes;Authorization: Basic S3CRET', 'AUTHWALL_SET_HEADERS entry 2 must contain "=": Header-Name=value'],
            ['X-Team=notes;=S3CRET', 'AUTHWALL_SET_HEADERS entry 2 must have a header name: Header-Name=value'],
            ['X-Team=notes;Authorization Basic S3CRET=', 'AUTHWALL_SET_HEADERS entry 2 must have a header name of letters, digits and -: Header-Name=value'],
            ['X-Team=notes;X-Key=S3CRET\x01', 'AUTHWALL_SET_HEADERS entry 2 must have a value a header can carry: no control characters'],
        ]) {
            assert.throws(() => parse_set_headers(value), function (error) {
                assert.strictEqual(error.message, message);
                assert.ok(!error.stack.includes('S3CRET'), error.stack);
                return true;
            });
        }
    });

});
