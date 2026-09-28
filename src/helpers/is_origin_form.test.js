const assert = require('assert');
const is_origin_form = require('./is_origin_form');

describe('is_origin_form', function () {

    it('accepts a path with an optional query', function () {
        for (const v of ['/', '/lib/app.js', '/lib/app.js?v=1', '/a?b=/../c', '/%23']) {
            assert.strictEqual(is_origin_form(v), true, v);
        }
    });

    it('rejects a fragment anywhere in the target', function () {
        for (const v of ['/favicon.ico#/../admin', '/lib/x#', '/#', '/a?b=1#c']) {
            assert.strictEqual(is_origin_form(v), false, v);
        }
    });

    it('rejects absolute, authority and asterisk forms', function () {
        for (const v of ['http://evil.test/admin', 'evil.test:443', '*', '', undefined]) {
            assert.strictEqual(is_origin_form(v), false, String(v));
        }
    });

});
