const assert = require('assert');
const make_config = require('../../../config/make_config');

describe('Username-only flow with email access rules | stories', function () {

    const env = {
        AUTHWALL_SECRET: '12345678901234567890123456789012',
        AUTHWALL_PUBLIC_URL: 'http://authwall.test',
        AUTHWALL_UPSTREAM_URL: 'http://127.0.0.1:8080',
        AUTHWALL_MAILER: 'fake',
        AUTHWALL_GOOGLE_CLIENT_ID: 'client-id',
        AUTHWALL_GOOGLE_CLIENT_SECRET: 'client-secret',
        AUTHWALL_GOOGLE_REDIRECT_URL: 'http://authwall.test/auth/google/callback',
    };

    const rules = [
        ['AUTHWALL_ALLOWED_EMAILS', 'mocha@authwall.test'],
        ['AUTHWALL_ALLOWED_DOMAINS', 'authwall.test'],
        ['AUTHWALL_DENIED_EMAILS', 'blocked@authwall.test'],
        ['AUTHWALL_DENIED_DOMAINS', 'blocked.test'],
    ];

    for (const [name, value] of rules) {
        it(`refuses to start with AUTHWALL_FLOWS=username and ${name}`, function () {
            assert.throws(
                () => make_config({...env, AUTHWALL_FLOWS: 'username', [name]: value}),
                new RegExp(`^Error: Email access rules \\(${name}\\) require an email, magic link, or OAuth flow to be enabled`)
            );
        });
    }

    it('names every rule variable that is set', function () {
        assert.throws(
            () => make_config({...env, AUTHWALL_FLOWS: 'username', ...Object.fromEntries(rules)}),
            /Email access rules \(AUTHWALL_ALLOWED_EMAILS, AUTHWALL_ALLOWED_DOMAINS, AUTHWALL_DENIED_EMAILS, AUTHWALL_DENIED_DOMAINS\) require/
        );
    });

    for (const flows of ['username,email', 'username,magic_link_and_code', 'username,google']) {
        it(`starts with AUTHWALL_FLOWS=${flows} and an access rule`, function () {
            const config = make_config({...env, AUTHWALL_FLOWS: flows, AUTHWALL_ALLOWED_DOMAINS: 'authwall.test'});
            assert.deepStrictEqual(config.access.allowed_domains, ['authwall.test']);
        });
    }

    it('starts with AUTHWALL_FLOWS=username and no access rules', function () {
        const config = make_config({...env, AUTHWALL_FLOWS: 'username'});
        assert.deepStrictEqual(config.access.allowed_domains, []);
    });
});
