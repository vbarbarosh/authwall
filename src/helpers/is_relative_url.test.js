const assert = require('assert');
const is_relative_url = require('./is_relative_url');

const tests = [
    // valid
    ['/', true],
    ['/foo', true],
    ['/foo/bar', true],
    ['/foo?x=1', true],
    ['/foo#hash', true],

    // invalid
    ['', false],
    ['foo', false],
    ['http://evil.com', false],
    ['//evil.com', false],
    ['///evil.com', false],
    ['////evil.com', false],
    ['/\\evil.com', false],
    ['javascript:alert(1)', false],
    ['/javascript:alert(1)', true],

    // quirks
    ['/%2f', false],
    ['/foo%2f', true],

    ['/foo\\bar', false],
];

describe('is_relative_url', function () {
    tests.forEach(function ([url, expected]) {
        it(`${url} → ${expected}`, function () {
            const actual = is_relative_url(url);
            assert.deepStrictEqual(actual, expected);
        });
    });
});
