const assert = require('assert');
const parse_trust_proxy = require('./parse_trust_proxy');

describe('parse_trust_proxy', function () {

    it('defaults to one hop when unset', function () {
        assert.strictEqual(parse_trust_proxy(undefined), 1);
        assert.strictEqual(parse_trust_proxy(''), 1);
        assert.strictEqual(parse_trust_proxy(null), 1);
    });

    it('reads a hop count', function () {
        assert.strictEqual(parse_trust_proxy('2'), 2);
        assert.strictEqual(parse_trust_proxy('0'), 0);
    });

    it('reads booleans case-insensitively', function () {
        assert.strictEqual(parse_trust_proxy('true'), true);
        assert.strictEqual(parse_trust_proxy('False'), false);
    });

    it('passes a list or preset through as a string', function () {
        assert.strictEqual(parse_trust_proxy('127.0.0.1, 10.0.0.0/8'), '127.0.0.1, 10.0.0.0/8');
        assert.strictEqual(parse_trust_proxy('loopback'), 'loopback');
    });

});
