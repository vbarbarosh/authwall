const assert = require('assert');
const parse_email_template = require('./parse_email_template');

const tests = [
    {
        label: '#1',
        template: `Subject: Welcome!

Hi {{display_name}},

Your account has been created. You can sign in at:
{{sign_in_link}}

— Authwall
`,
        placeholders: {
            display_name: null,
            sign_in_link: 'https://127.0.0.1:3000/auth/sign-in',
        },
        expected: {
            subject: 'Welcome!',
            body: `Hi,

Your account has been created. You can sign in at:
https://127.0.0.1:3000/auth/sign-in

— Authwall`,
        },
    },
];

describe('parse_email_template', function () {
    tests.forEach(function ({label, template, placeholders, expected}) {
        it(label, function () {
            const actual = parse_email_template(template, placeholders);
            assert.deepStrictEqual(actual, expected);
        });
    });
});
