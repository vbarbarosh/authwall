const assert = require('assert');
const make_config = require('../../../config/make_config');

describe('AUTHWALL_FLOWS invalid values throw | config', function () {

    it('rejects unsupported AUTHWALL_FLOWS values', function () {
        assert.throws(run, /AUTHWALL_FLOWS contains unsupported value\(s\): magick_link_and_code/);
        function run() {
            make_config({
                AUTHWALL_SECRET: '12345678901234567890123456789012',
                AUTHWALL_PUBLIC_URL: 'http://authwall.test',
                AUTHWALL_UPSTREAM_URL: 'http://127.0.0.1:8080',
                AUTHWALL_FLOWS: 'username,magick_link_and_code',
            });
        }
    });

});
