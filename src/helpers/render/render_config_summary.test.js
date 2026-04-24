const assert = require('assert');
const render_config_summary = require('./render_config_summary');

describe('render_config_summary', function () {

    it('formats a resolved config summary without leaking secrets', function () {
        const lines = render_config_summary({
            listen: '0.0.0.0',
            port: 3000,
            public_url: 'https://authwall.test',
            logger: 'stdout',
            target: {
                url: 'http://app:8080',
                mode: 'proxy',
                set_headers: [{name: 'Authorization', value: 'Bearer secret'}],
                unset_headers: ['X-Auth-User'],
            },
            public_paths: ['/favicon.ico'],
            knexvars: {
                client: 'mysql2',
                connection: {
                    uri: 'mysql://authwall:db-secret@mysql/authwall',
                    charset: 'utf8mb4',
                    timezone: 'Z',
                },
                custom: {
                    name: 'mysql',
                    label: 'MySQL',
                },
            },
            cookie: {
                domain: null,
                path: '/',
                secure: true,
                same_site: 'none',
                max_age_days: 30,
            },
            flows: {
                password: {
                    enabled: true,
                    allow_username: true,
                    allow_email: false,
                    min_password_length: 8,
                },
                magic_link: {
                    enabled: false,
                    mode: 'link_and_code',
                },
                google: {
                    enabled: true,
                    client_id: 'google-client',
                    client_secret: 'google-secret',
                    redirect_url: 'https://authwall.test/auth/google/callback',
                },
                github: {
                    enabled: false,
                    client_id: null,
                    client_secret: null,
                    redirect_url: null,
                },
            },
            mailer: {
                enabled: true,
                provider: 'resend',
                resend: {
                    key: 'resend-secret',
                    from: 'Authwall <noreply@authwall.test>',
                },
                mailjet: {
                    key: null,
                    secret: null,
                    from: null,
                },
                ses: {
                    region: 'us-east-1',
                    key: null,
                    secret: null,
                    session_token: null,
                    from: null,
                },
            },
            access: {
                allowed_emails: ['admin@authwall.test'],
                denied_emails: [],
                allowed_domains: ['authwall.test'],
                denied_domains: [],
            },
            seed_users: [{username: 'admin'}],
            logs_dir: '/app/data/logs',
            uploads_dir: '/app/data/uploads',
            pages: {
                sign_in: '/auth/sign-in',
            },
        });
        const text = lines.join('\n');

        assert.match(text, /⚙️ Config summary/);
        assert.match(text, /🌐 Server: https:\/\/authwall.test → 0.0.0.0:3000/);
        assert.match(text, /🧭 Target: proxy → http:\/\/app:8080\/ \(set Authorization; unset X-Auth-User\)/);
        assert.match(text, /🗄️ Database: MySQL mysql:\/\/authwall:\*\*\*@mysql\/authwall/);
        assert.match(text, /🔐 Sign-in:/);
        assert.match(text, / - password: username, min 8/);
        assert.match(text, / - Google OAuth: https:\/\/authwall.test\/auth\/google\/callback/);
        assert.match(text, /📭 Mailer: Resend from Authwall <noreply@authwall.test>/);
        assert.match(text, /🚪 Public paths:\n\[config]   - \/favicon.ico/);
        assert.match(text, /👤 Seed users:\n\[config]   - admin/);
        assert.match(text, /mysql:\/\/authwall:\*\*\*@mysql\/authwall/);
        assert.doesNotMatch(text, /Bearer secret/);
        assert.doesNotMatch(text, /db-secret/);
        assert.doesNotMatch(text, /resend-secret/);
        assert.doesNotMatch(text, /google-secret/);
    });

});
