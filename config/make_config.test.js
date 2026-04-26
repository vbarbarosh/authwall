const assert = require('assert');
const make_config = require('./make_config');

describe('make_config', function () {

    it('builds config from an env-like input object', function () {
        const config = make_config({
            AUTHWALL_SECRET: '12345678901234567890123456789012',
            AUTHWALL_PUBLIC_URL: 'https://notes.example.com',
            AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
            AUTHWALL_TARGET_MODE: 'proxy',
            AUTHWALL_SET_HEADERS: 'X-Team=notes;X-Empty=',
            AUTHWALL_UNSET_HEADERS: 'X-Auth-User',
            AUTHWALL_COOKIE_SAMESITE: 'lax',
            AUTHWALL_FLOWS: 'username',
        });

        assert.partialDeepStrictEqual(config, {
            public_url: 'https://notes.example.com',
            cookie: {
                secure: true,
                same_site: 'lax',
            },
            target: {
                set_headers: [
                    {name: 'X-Team', value: 'notes'},
                    {name: 'X-Empty', value: ''},
                ],
                unset_headers: [
                    'X-Auth-User',
                ],
            },
            flows: {
                password: {
                    enabled: true,
                    allow_username: true,
                    allow_email: false,
                },
                google: {
                    enabled: false,
                },
                github: {
                    enabled: false,
                },
                microsoft: {
                    enabled: false,
                },
                facebook: {
                    enabled: false,
                },
                twitter: {
                    enabled: false,
                },
                discord: {
                    enabled: false,
                },
            },
        });
        assert.strictEqual(config.target.set_headers.length, 2);
        assert.strictEqual(config.target.unset_headers.length, 1);
    });

    it('does not leak resolved settings across calls', function () {
        const config1 = make_config({
            AUTHWALL_SECRET: '12345678901234567890123456789012',
            AUTHWALL_PUBLIC_URL: 'https://first.example.com',
            AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
        });
        const config2 = make_config({
            AUTHWALL_SECRET: '12345678901234567890123456789012',
            AUTHWALL_PUBLIC_URL: 'http://second.example.com',
            AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
        });

        assert.partialDeepStrictEqual(config1, {
            public_url: 'https://first.example.com',
            cookie: {
                secure: true,
            },
        });
        assert.partialDeepStrictEqual(config2, {
            public_url: 'http://second.example.com',
            cookie: {
                secure: false,
            },
        });
    });

    it('normalizes access email allowlists the same way as login emails', function () {
        const config = make_config({
            AUTHWALL_SECRET: '12345678901234567890123456789012',
            AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
            AUTHWALL_ALLOWED_EMAILS: 'jonny.small@gmail.com',
        });

        assert.deepStrictEqual(config.access.allowed_emails, ['jonnysmall@gmail.com']);
    });

    it('rejects invalid access-list emails instead of silently dropping them', function () {
        assert.throws(run, /AUTHWALL_ALLOWED_EMAILS contains invalid email/);
        function run() {
            make_config({
                AUTHWALL_SECRET: '12345678901234567890123456789012',
                AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
                AUTHWALL_ALLOWED_EMAILS: 'jonny.small@gmail.com;',
            });
        }
    });

    it('rejects unrecognized AUTHWALL env vars', function () {
        assert.throws(
            () => make_config({
                AUTHWALL_SECRET: '12345678901234567890123456789012',
                AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
                AUTHWALL_TAREGT_URL: 'http://typo.test',
            }),
            /Unrecognized AUTHWALL env var\(s\): AUTHWALL_TAREGT_URL/
        );
    });

    it('allows unrelated env vars', function () {
        const config = make_config({
            AUTHWALL_SECRET: '12345678901234567890123456789012',
            AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
            NODE_ENV: 'test',
            PATH: '/bin',
        });

        assert.strictEqual(config.target.url, 'http://127.0.0.1:8080');
    });

});
