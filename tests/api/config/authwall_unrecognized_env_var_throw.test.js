const assert = require('assert');
const make_config = require('../../../config/make_config');

describe('AUTHWALL unrecognized env vars throw | config', function () {

    it('rejects unrecognized AUTHWALL env vars', function () {
        assert.throws(run, /Unrecognized AUTHWALL env var\(s\): AUTHWALL_UPSTRAEM_URL/);
        function run() {
            make_config({
                AUTHWALL_SECRET: '12345678901234567890123456789012',
                AUTHWALL_PUBLIC_URL: 'http://authwall.test',
                AUTHWALL_UPSTREAM_URL: 'http://127.0.0.1:8080',
                AUTHWALL_UPSTRAEM_URL: 'http://wrong.test',
            });
        }
    });

});
