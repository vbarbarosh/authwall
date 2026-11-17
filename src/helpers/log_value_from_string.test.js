const assert = require('assert');
const log_value_from_string = require('./log_value_from_string');

describe('log_value_from_string', function () {

    it('writes a printable ASCII word bare', function () {
        assert.strictEqual(log_value_from_string('admin'), 'admin');
        assert.strictEqual(log_value_from_string('a'), 'a');
        assert.strictEqual(log_value_from_string('ops.team-1_x!~'), 'ops.team-1_x!~');
    });

    it('JSON-quotes a string with a space, a quote, a backslash or a bracket', function () {
        assert.strictEqual(log_value_from_string('the admin'), '"the admin"');
        assert.strictEqual(log_value_from_string('a"b'), '"a\\"b"');
        assert.strictEqual(log_value_from_string('a\\b'), '"a\\\\b"');
        assert.strictEqual(log_value_from_string('[authwall_ready]'), '"[authwall_ready]"');
        assert.strictEqual(log_value_from_string('a]b'), '"a]b"');
    });

    it('JSON-quotes an empty string, a line break and what is not ASCII', function () {
        assert.strictEqual(log_value_from_string(''), '""');
        assert.strictEqual(log_value_from_string('a\nb'), '"a\\nb"');
        assert.strictEqual(log_value_from_string('админ'), '"админ"');
    });

});
