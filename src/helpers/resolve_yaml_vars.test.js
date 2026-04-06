const assert = require('assert');
const resolve_yaml_vars = require('./resolve_yaml_vars');

describe('resolve_yaml_vars', function () {

    it('mutates array in place', function () {
        const input = ['${FOO}', 123];
        const actual = resolve_yaml_vars(input, {FOO: 'bar'});
        assert.strictEqual(actual, input);
        assert.deepStrictEqual(actual, ['bar', 123]);
    });

    it('mutates object in place', function () {
        const input = {a: '${FOO}'};
        const actual = resolve_yaml_vars(input, {FOO: 'bar'});
        assert.strictEqual(actual, input);
        assert.deepStrictEqual(actual, {a: 'bar'});
    });

    it('replaces multiple and repeated variables in one string', function () {
        const input = '${A}-${B}-${A}';
        const actual = resolve_yaml_vars(input, {A: 1, B: 2});
        assert.strictEqual(actual, '1-2-1');
    });

    it('replaces missing variables with empty string', function () {
        const input = 'a${MISSING}b';
        const actual = resolve_yaml_vars(input);
        assert.strictEqual(actual, 'ab');
    });

    it('works for nested structures', function () {
        const input = {
            a: ['${FOO}', {b: '${FOO}'}],
        };
        const actual = resolve_yaml_vars(input, {FOO: 'bar'});
        assert.deepStrictEqual(actual, {a: ['bar', {b: 'bar'}]});
    });

    it('leaves non-strings unchanged', function () {
        const input = {a: 1, b: true, c: null, d: 'plain text'};
        const actual = resolve_yaml_vars(input);
        assert.deepStrictEqual(actual, input);
    });

    it('handles circular references', function () {
        const input = {self: null, value: '${FOO}'};
        input.self = input;
        const actual = resolve_yaml_vars(input, {FOO: 'bar'});
        assert.strictEqual(actual.self, input.self);
        assert.strictEqual(actual.value, 'bar');
    });

    it('handles shared references', function () {
        const ref = {foo: '${FOO}'};
        const input = {a: ref, b: ref};
        const actual = resolve_yaml_vars(input, {FOO: 'bar'});
        assert.strictEqual(actual.a, actual.b);
    });

});
