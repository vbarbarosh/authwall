const assert = require('assert');
const canonical_path = require('./canonical_path');

describe('canonical_path', function () {

    it('returns canonical paths unchanged', function () {
        assert.strictEqual(canonical_path('/'), '/');
        assert.strictEqual(canonical_path('/lib/app.js'), '/lib/app.js');
        assert.strictEqual(canonical_path('/lib/app.js/'), '/lib/app.js/');
        assert.strictEqual(canonical_path('/a.b/c-d_e~f'), '/a.b/c-d_e~f');
    });

    it('decodes percent-encoding once', function () {
        assert.strictEqual(canonical_path('/lib/app%20name.js'), '/lib/app name.js');
        assert.strictEqual(canonical_path('/favicon%2Eico'), '/favicon.ico');
    });

    it('rejects dot segments in any encoding', function () {
        for (const p of ['/lib/../admin', '/lib/%2e%2e/admin', '/lib/..%2fadmin', '/lib/%2e%2e%2fadmin', '/lib/./admin', '/lib/x/../../admin', '/lib/;/../admin', '/..', '/lib/..']) {
            assert.strictEqual(canonical_path(p), null, p);
        }
    });

    it('rejects duplicate slashes, backslashes, NUL and double-encoded separators', function () {
        for (const p of ['/lib//admin', '//lib/admin', '/lib\\admin', '/lib%5cadmin', '/lib%00', '/lib/%252fadmin', '/lib/%252Fadmin']) {
            assert.strictEqual(canonical_path(p), null, p);
        }
    });

    it('rejects undecodable and non-path input', function () {
        for (const p of ['/lib/%zz', '/lib/%', 'lib/app.js', '', null, undefined, 42]) {
            assert.strictEqual(canonical_path(p), null, String(p));
        }
    });

});
