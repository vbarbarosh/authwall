const assert = require('assert');
const make_config = require('./make_config');

describe('make_config', function () {

    it('builds config from an env-like input object', function () {
        const config = make_config({
            AUTHWALL_SECRET: '12345678901234567890123456789012',
            AUTHWALL_PUBLIC_URL: 'https://notes.example.com',
            AUTHWALL_PUBLIC_PATHS: '/favicon.ico,/lib/*;/designs/*\n/robots.txt',
            AUTHWALL_OPTIONAL_AUTH_PATHS: '/,/landing/*;/home',
            AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
            AUTHWALL_TARGET_MODE: 'proxy',
            AUTHWALL_SET_HEADERS: 'X-Team=notes;X-Empty=',
            AUTHWALL_UNSET_HEADERS: 'X-Auth-User',
            AUTHWALL_COOKIE_SAMESITE: 'lax',
            AUTHWALL_FLOWS: 'username',
        });

        assert.partialDeepStrictEqual(config, {
            public_url: 'https://notes.example.com',
            public_paths: ['/favicon.ico', '/lib/*', '/designs/*', '/robots.txt'],
            optional_auth_paths: ['/', '/landing/*', '/home'],
            sentry: {
                enabled: false,
            },
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
            personal_access_tokens: {
                enabled: false,
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

    it('configures personal access tokens as disabled by default', function () {
        const config = make_config({
            AUTHWALL_SECRET: '12345678901234567890123456789012',
            AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
        });

        assert.deepStrictEqual(config.personal_access_tokens, {
            enabled: false,
        });
    });

    it('enables personal access tokens with AUTHWALL_PERSONAL_ACCESS_TOKENS', function () {
        const config = make_config({
            AUTHWALL_SECRET: '12345678901234567890123456789012',
            AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
            AUTHWALL_PERSONAL_ACCESS_TOKENS: 'on',
        });

        assert.deepStrictEqual(config.personal_access_tokens, {
            enabled: true,
        });
    });

    it('configures Sentry when AUTHWALL_SENTRY_DSN is set', function () {
        const config = make_config({
            AUTHWALL_SECRET: '12345678901234567890123456789012',
            AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
            AUTHWALL_SENTRY_DSN: 'https://public@example.com/1',
            AUTHWALL_SENTRY_ENVIRONMENT: 'production',
            AUTHWALL_SENTRY_TRACES_SAMPLE_RATE: '0.25',
        });

        assert.partialDeepStrictEqual(config, {
            sentry: {
                enabled: true,
                dsn: 'https://public@example.com/1',
                environment: 'production',
                traces_sample_rate: 0.25,
            },
        });
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

    it('auto-enables email verification when email flow is enabled', function () {
        const config = make_config({
            AUTHWALL_SECRET: '12345678901234567890123456789012',
            AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
            AUTHWALL_MAILER: 'fake',
            AUTHWALL_FLOWS: 'username,email',
        });

        assert.strictEqual(config.confirm_email.required, true);
    });

    it('configures email confirmation mode like magic link mode', function () {
        const config = make_config({
            AUTHWALL_SECRET: '12345678901234567890123456789012',
            AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
            AUTHWALL_MAILER: 'fake',
            AUTHWALL_CONFIRM_EMAIL: 'code',
        });

        assert.partialDeepStrictEqual(config.confirm_email, {
            enabled: true,
            mode: 'code',
            expires_minutes: 15,
            code_length: 6,
            max_attempts: 5,
            resend_cooldown_seconds: 60,
        });
    });

    it('rejects explicit email confirmation mode without a configured mailer', function () {
        assert.throws(
            () => make_config({
                AUTHWALL_SECRET: '12345678901234567890123456789012',
                AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
                AUTHWALL_CONFIRM_EMAIL: 'code',
            }),
            /AUTHWALL_CONFIRM_EMAIL=code requires a configured mailer/
        );
    });

    it('auto-disables email verification when email flow is disabled', function () {
        const config = make_config({
            AUTHWALL_SECRET: '12345678901234567890123456789012',
            AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
            AUTHWALL_FLOWS: 'username',
        });

        assert.strictEqual(config.confirm_email.required, false);
    });

    it('allows explicit email verification disable with email flow enabled', function () {
        const config = make_config({
            AUTHWALL_SECRET: '12345678901234567890123456789012',
            AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
            AUTHWALL_MAILER: 'fake',
            AUTHWALL_FLOWS: 'username,email',
            AUTHWALL_CONFIRM_EMAIL_REQUIRED: 'false',
        });

        assert.strictEqual(config.confirm_email.required, false);
    });

    it('rejects explicit email verification enable without email flow', function () {
        assert.throws(
            () => make_config({
                AUTHWALL_SECRET: '12345678901234567890123456789012',
                AUTHWALL_TARGET_URL: 'http://127.0.0.1:8080',
                AUTHWALL_FLOWS: 'username',
                AUTHWALL_CONFIRM_EMAIL_REQUIRED: 'true',
            }),
            /AUTHWALL_CONFIRM_EMAIL_REQUIRED requires the email flow to be enabled/
        );
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
