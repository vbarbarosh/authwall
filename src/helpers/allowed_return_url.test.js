const allowed_return_url = require('./allowed_return_url');
const assert = require('assert');
const config = require('../../config');

describe('allowed_return_url', function () {

    let public_url = null;

    beforeEach(function () {
        public_url = config.public_url;
        config.public_url = 'https://corp.test';
    });

    afterEach(function () {
        config.public_url = public_url;
    });

    for (const value of ['/reports', '/reports?year=2026#q3', '/%09/evil.test', '/..//evil.test', 'https://corp.test/a', 'https://wiki.corp.test/page']) {
        it(`keeps ${JSON.stringify(value)} as given`, function () {
            assert.strictEqual(allowed_return_url(value), value);
        });
    }

    // A browser drops tabs and line breaks before it reads a URL, so each of
    // these is //evil.test to it (AW-113).
    for (const value of ['/\t/evil.test', '/\n/evil.test', '/\r/evil.test', '/\t\t/evil.test', '/x\u0000', '//evil.test', '/\\evil.test', 'https://evil.test/', 'https://corp.test.evil.test/', null]) {
        it(`refuses ${JSON.stringify(value)}`, function () {
            assert.strictEqual(allowed_return_url(value), null);
        });
    }

});
