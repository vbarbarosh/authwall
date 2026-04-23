const assert = require('assert');
const parse_unset_headers = require('./parse_unset_headers');

describe('parse_unset_headers', function () {

    it('parses semicolon-separated header names', function () {
        assert.deepStrictEqual(parse_unset_headers('X-Auth-User;X-Team'), [
            'X-Auth-User',
            'X-Team',
        ]);
    });

    it('ignores empty segments and surrounding whitespace', function () {
        assert.deepStrictEqual(parse_unset_headers(' ; X-Auth-User ; ; X-Team ; '), [
            'X-Auth-User',
            'X-Team',
        ]);
    });

    it('rejects invalid header names', function () {
        assert.throws(
            () => parse_unset_headers('Bad Header'),
            /Header name must be a valid HTTP token/
        );
    });

});
