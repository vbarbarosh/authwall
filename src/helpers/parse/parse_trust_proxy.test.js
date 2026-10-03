const assert = require('assert');
const parse_trust_proxy = require('./parse_trust_proxy');

describe('parse_trust_proxy', function () {

    it('defaults to one hop when unset', function () {
        assert.strictEqual(parse_trust_proxy(undefined), 1);
        assert.strictEqual(parse_trust_proxy(''), 1);
        assert.strictEqual(parse_trust_proxy(null), 1);
    });

    it('reads none, hops/N and any, case-insensitively', function () {
        assert.strictEqual(parse_trust_proxy('none'), false);
        assert.strictEqual(parse_trust_proxy('None'), false);
        assert.strictEqual(parse_trust_proxy('hops/1'), 1);
        assert.strictEqual(parse_trust_proxy('HOPS/2'), 2);
        assert.strictEqual(parse_trust_proxy(' hops/3 '), 3);
        assert.strictEqual(parse_trust_proxy('any'), true);
    });

    it('passes a list of addresses, subnets and presets through as a string', function () {
        assert.strictEqual(parse_trust_proxy('127.0.0.1, 10.0.0.0/8'), '127.0.0.1, 10.0.0.0/8');
        assert.strictEqual(parse_trust_proxy('loopback'), 'loopback');
        assert.strictEqual(parse_trust_proxy('loopback,::1,fd00::/8'), 'loopback,::1,fd00::/8');
    });

    it('refuses the old values with their replacement', function () {
        assert.throws(() => parse_trust_proxy('true'), /^Error: AUTHWALL_TRUST_PROXY=true is now written any$/);
        assert.throws(() => parse_trust_proxy('False'), /^Error: AUTHWALL_TRUST_PROXY=False is now written none$/);
        assert.throws(() => parse_trust_proxy('0'), /^Error: AUTHWALL_TRUST_PROXY=0 is now written none$/);
        assert.throws(() => parse_trust_proxy('1'), /^Error: AUTHWALL_TRUST_PROXY=1 is now written hops\/1$/);
        assert.throws(() => parse_trust_proxy('2'), /^Error: AUTHWALL_TRUST_PROXY=2 is now written hops\/2$/);
    });

    it('refuses hops/0, which is written none', function () {
        assert.throws(() => parse_trust_proxy('hops/0'), /^Error: AUTHWALL_TRUST_PROXY=hops\/0 is written none$/);
    });

    it('refuses none, any and hops/N inside a list', function () {
        for (const v of ['none, 10.0.0.1', 'loopback, any', '10.0.0.0/8, hops/2']) {
            assert.throws(() => parse_trust_proxy(v), /stands alone, not in a list/, v);
        }
    });

    it('refuses an entry that is not an address, a subnet or a preset', function () {
        for (const v of ['no', 'yes', 'off', 'hops/x', '10.0.0.0/8,,loopback', '300.1.1.1', 'loopback, nope']) {
            assert.throws(() => parse_trust_proxy(v), /^Error: AUTHWALL_TRUST_PROXY: ".*" is not an address, a subnet or a preset/, v);
        }
    });

});
