const assert = require('assert');
const format_email_address = require('./format_email_address');

const tests = [
    ['foo@bar.com', 'foo@bar.com'],

    [{name: '', email: 'foo@bar.com'}, 'foo@bar.com'],
    [{name: null, email: 'foo@bar.com'}, 'foo@bar.com'],
    [{name: undefined, email: 'foo@bar.com'}, 'foo@bar.com'],

    [{name: 'John', email: 'foo@bar.com'}, 'John <foo@bar.com>'],
    [{name: 'John Doe', email: 'foo@bar.com'}, 'John Doe <foo@bar.com>'],
    [{name: 'John, Jr.', email: 'foo@bar.com'}, '"John, Jr." <foo@bar.com>'],

    // quotes
    [{name: 'John "Danger"', email: 'foo@bar.com'}, '"John \\"Danger\\"" <foo@bar.com>'],

    // angle brackets
    [{name: 'John <Danger>', email: 'foo@bar.com'}, '"John <Danger>" <foo@bar.com>'],

    // array support
    [
        ['a@a.com', {name: 'John', email: 'b@b.com'}],
        'a@a.com, John <b@b.com>'
    ],
];

describe('format_email_address', function () {
    tests.forEach(function ([input, expected]) {
        it(`${JSON.stringify(input)} → ${expected}`, function () {
            const actual = format_email_address(input);
            assert.equal(actual, expected);
        });
    });
});
