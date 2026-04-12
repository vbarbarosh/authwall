const assert = require('assert');

function assert_shape(actual, shape)
{
    // 1. keys must match exactly
    const actual_keys = Object.keys(actual).sort();
    const shape_keys = Object.keys(shape).sort();
    assert.deepStrictEqual(actual_keys, shape_keys, 'Both objects should have same keys');

    // 2. validate values
    for (const key of shape_keys) {
        const value = actual[key];
        const expected = shape[key];

        if (expected === String) {
            assert.strictEqual(typeof value, 'string', `key "${key}" should be string`);
        }
        else if (expected === Number) {
            assert.strictEqual(typeof value, 'number', `key "${key}" should be number`);
        }
        else if (expected === Boolean) {
            assert.strictEqual(typeof value, 'boolean', `key "${key}" should be boolean`);
        }
        else if (expected === null) {
            assert.strictEqual(value, null, `key "${key}" should be null`);
        }
        else if (typeof expected === 'object') {
            assert_shape(value, expected);
        }
        else {
            assert.deepStrictEqual(value, expected, `key "${key}" mismatch`);
        }
    }
}

module.exports = assert_shape;
