const assert = require('assert');
const make_config = require('../../../config/make_config');

describe('AUTHWALL_DB=sqlite://<file> | config', function () {

    const base = {
        AUTHWALL_SECRET: '12345678901234567890123456789012',
        AUTHWALL_PUBLIC_URL: 'http://authwall.test',
        AUTHWALL_UPSTREAM_URL: 'http://127.0.0.1:8080',
    };

    it('uses the given file instead of data/db.sqlite3', function () {
        const config = make_config({...base, AUTHWALL_DB: 'sqlite:///tmp/authwall-side.sqlite3'});
        assert.strictEqual(config.knexvars.client, 'better-sqlite3');
        assert.strictEqual(config.knexvars.connection.filename, '/tmp/authwall-side.sqlite3');
    });

    it('keeps the default file when unset', function () {
        const config = make_config(base);
        assert.match(config.knexvars.connection.filename, /\/data\/db\.sqlite3$/);
    });

    it('rejects sqlite:// without a path', function () {
        assert.throws(() => make_config({...base, AUTHWALL_DB: 'sqlite://'}), /requires a file path/);
    });

});
