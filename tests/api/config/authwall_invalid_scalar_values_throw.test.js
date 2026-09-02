const assert = require('assert');
const make_config = require('../../../config/make_config');

const base = {
    AUTHWALL_SECRET: '12345678901234567890123456789012',
    AUTHWALL_PUBLIC_URL: 'http://authwall.test',
    AUTHWALL_UPSTREAM_URL: 'http://127.0.0.1:8080',
    AUTHWALL_MAILER: 'fake',
};

function build(overrides) {
    return () => make_config({...base, ...overrides});
}

describe('invalid scalar config values throw | config', function () {

    const cases = [
        ['AUTHWALL_BCRYPT_ROUNDS', '1', /integer in \[4, 31\]/],
        ['AUTHWALL_BCRYPT_ROUNDS', 'abc', /integer in \[4, 31\]/],
        ['AUTHWALL_PASSWORD_MIN', '100', /integer in \[4, 32\]/],
        ['AUTHWALL_SENTRY_TRACES_SAMPLE_RATE', '5', /number in \[0, 1\]/],
        ['AUTHWALL_UPSTREAM_MODE', 'proxxy', /one of direct, proxy/],
        ['AUTHWALL_COOKIE_SAMESITE', 'sideways', /one of lax, strict, none/],
        ['AUTHWALL_COOKIE_SECURE', 'nope', /must be a boolean/],
        ['AUTHWALL_PERSONAL_ACCESS_TOKENS', 'disabled', /must be a boolean/],
        ['AUTHWALL_WEBSOCKETS', '2', /must be a boolean/],
        ['AUTHWALL_LOGGER', 'syslog', /one of daily, stdout/],
        ['AUTHWALL_MAILER', 'sendgrid', /one of auto, fake, resend, mailjet, ses/],
        ['PORT', '70000', /port number in \[1, 65535\]/],
        ['PORT', 'abc', /port number in \[1, 65535\]/],
    ];

    for (const [name, value, pattern] of cases) {
        it(`rejects ${name}=${value}`, function () {
            assert.throws(build({[name]: value}), pattern);
        });
    }

    it('treats an empty value as unset and uses the default', function () {
        const config = make_config({...base, AUTHWALL_PUBLIC_URL: 'https://authwall.test', AUTHWALL_COOKIE_SECURE: '', AUTHWALL_BCRYPT_ROUNDS: ''});
        assert.strictEqual(config.cookie.secure, true);
        assert.strictEqual(config.bcrypt_rounds, 12);
    });

    it('normalizes enum case', function () {
        const config = make_config({...base, AUTHWALL_COOKIE_SAMESITE: 'Strict', AUTHWALL_UPSTREAM_MODE: 'PROXY'});
        assert.strictEqual(config.cookie.same_site, 'strict');
        assert.strictEqual(config.upstream.mode, 'proxy');
    });

    it('honors a boolean flag that used to be ignored', function () {
        assert.strictEqual(make_config({...base, AUTHWALL_CONFIRM_EMAIL_REQUIRED: '0'}).confirm_email.required, false);
        assert.strictEqual(make_config({...base, AUTHWALL_WEBSOCKETS: 'off'}).websockets.enabled, false);
    });

});
