const assert = require('assert');
const target_path = require('./target_path');

describe('target_path', function () {

    it('returns the path before the query, unchanged', function () {
        assert.strictEqual(target_path('/lib/app.js'), '/lib/app.js');
        assert.strictEqual(target_path('/lib/app.js?v=/../x'), '/lib/app.js');
        assert.strictEqual(target_path('/lib/%2e%2e/admin'), '/lib/%2e%2e/admin');
        assert.strictEqual(target_path('/lib\\admin'), '/lib\\admin');
        assert.strictEqual(target_path('/lib/../admin'), '/lib/../admin');
    });

    it('drops only the scheme and host of an absolute URL', function () {
        assert.strictEqual(target_path('http://app.test/lib/app.js?v=1'), '/lib/app.js');
        assert.strictEqual(target_path('https://app.test:8443/lib\\admin'), '/lib\\admin');
        assert.strictEqual(target_path('http://app.test/lib/../admin'), '/lib/../admin');
    });

    it('returns null for a fragment or a target that is not a path', function () {
        for (const v of ['/favicon.ico#/../admin', 'http://app.test/favicon.ico#/../admin', 'http://app.test', 'app.test/lib', '*', '', null, undefined]) {
            assert.strictEqual(target_path(v), null, String(v));
        }
    });

});
