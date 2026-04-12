const assert = require('assert');

function assert_shape(actual, shape)
{
    // array_of(...)
    if (shape && shape.__type === 'array_of') {
        assert.ok(Array.isArray(actual), 'Expected array');

        for (let i = 0, ii = actual.length; i < ii; i++) {
            assert_shape(actual[i], shape.shape);
        }
        return;
    }

    // enum(...)
    if (shape && shape.__type === 'enum') {
        const ok = shape.values.some(function (v) {
            try {
                assert.deepStrictEqual(actual, v);
                return true;
            }
            catch {
                return false;
            }
        });
        assert.ok(ok, `Value ${JSON.stringify(actual)} not in enum ${JSON.stringify(shape.values)}`);
        return;
    }

    // primitives
    if (shape === String) {
        assert.strictEqual(typeof actual, 'string', 'Expected string');
        return;
    }
    if (shape === Number) {
        assert.strictEqual(typeof actual, 'number', 'Expected number');
        return;
    }
    if (shape === Boolean) {
        assert.strictEqual(typeof actual, 'boolean', 'Expected boolean');
        return;
    }
    if (shape === null) {
        assert.strictEqual(actual, null, 'Expected null');
        return;
    }

    // object
    if (typeof shape === 'object') {
        const actual_keys = Object.keys(actual).sort();
        const shape_keys = Object.keys(shape).sort();
        assert.deepStrictEqual(actual_keys, shape_keys, 'Both objects should have same keys');

        for (const key of shape_keys) {
            assert_shape(actual[key], shape[key]);
        }
        return;
    }

    // literal
    assert.deepStrictEqual(actual, shape, 'Value mismatch');
}

// helpers
assert_shape.array_of = function (shape) {
    return {__type: 'array_of', shape};
};

assert_shape.enum = function (...values) {
    return {__type: 'enum', values};
};

module.exports = assert_shape;
