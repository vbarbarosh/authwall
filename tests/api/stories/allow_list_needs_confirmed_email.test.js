const assert = require('assert');
const make_config = require('../../../config/make_config');

// See allow_list_needs_confirmed_email.md.
describe('An allow list needs confirmed addresses | stories', function () {

    const env = {
        AUTHWALL_SECRET: '12345678901234567890123456789012',
        AUTHWALL_PUBLIC_URL: 'http://authwall.test',
        AUTHWALL_UPSTREAM_URL: 'http://127.0.0.1:8080',
        AUTHWALL_MAILER: 'fake',
    };

    for (const [name, value] of [['AUTHWALL_ALLOWED_DOMAINS', 'corp.test'], ['AUTHWALL_ALLOWED_EMAILS', 'mocha@corp.test']]) {
        it(`refuses to start with ${name}, the email flow and confirmation off`, function () {
            assert.throws(
                () => make_config({...env, AUTHWALL_FLOWS: 'email', AUTHWALL_CONFIRM_EMAIL_REQUIRED: 'false', [name]: value}),
                new RegExp(`^Error: Email allow rules \\(${name}\\) need confirmed addresses: set AUTHWALL_CONFIRM_EMAIL_REQUIRED=true, or disable the email flow$`)
            );
        });
    }

    it('starts with confirmation required or left unset', function () {
        make_config({...env, AUTHWALL_FLOWS: 'email', AUTHWALL_CONFIRM_EMAIL_REQUIRED: 'true', AUTHWALL_ALLOWED_DOMAINS: 'corp.test'});
        const config = make_config({...env, AUTHWALL_FLOWS: 'email', AUTHWALL_ALLOWED_DOMAINS: 'corp.test'});
        assert.strictEqual(config.confirm_email.required, true);
    });

    it('starts with confirmation off when no flow takes a typed address', function () {
        make_config({...env, AUTHWALL_FLOWS: 'magic_link', AUTHWALL_CONFIRM_EMAIL_REQUIRED: 'false', AUTHWALL_ALLOWED_DOMAINS: 'corp.test'});
    });

    it('starts with confirmation off and only deny rules', function () {
        make_config({...env, AUTHWALL_FLOWS: 'email', AUTHWALL_CONFIRM_EMAIL_REQUIRED: 'false', AUTHWALL_DENIED_DOMAINS: 'evil.test'});
    });

});
