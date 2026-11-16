const assert = require('assert');
const make_config = require('./make_config');

describe('AUTHWALL_SIGN_UP', function () {
    for (const value of [undefined, '', 'yes', 'on', 'true', '1', 'y', ' TRUE ', ' Y ', true, 1]) {
        it(`enables signup for ${JSON.stringify(value)}`, function () {
            const env = {AUTHWALL_SECRET: '12345678901234567890123456789012'};
            if (value !== undefined) {
                env.AUTHWALL_SIGN_UP = value;
            }
            const config = make_config(env);
            assert.strictEqual(config.sign_up.enabled, true);
        });
    }
    for (const value of ['no', 'off', 'false', '0', 'n', ' OFF ', 'FaLsE', ' N ', false, 0]) {
        it(`disables signup for ${JSON.stringify(value)}`, function () {
            const config = make_config({AUTHWALL_SECRET: '12345678901234567890123456789012', AUTHWALL_SIGN_UP: value});
            assert.strictEqual(config.sign_up.enabled, false);
            assert.strictEqual(config.flows.password.enabled, true);
        });
    }
    for (const value of ['enabled', 'disabled', 'disable', 'auto', 'false,no', '2', '-1', 'null', 'undefined', '   ']) {
        it(`rejects ${JSON.stringify(value)} at startup`, function () {
            assert.throws(run, /AUTHWALL_SIGN_UP must be/);

            function run() {
                make_config({AUTHWALL_SECRET: '12345678901234567890123456789012', AUTHWALL_SIGN_UP: value});
            }
        });
    }
});
