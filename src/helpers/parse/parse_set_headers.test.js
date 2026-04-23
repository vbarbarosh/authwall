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

});
