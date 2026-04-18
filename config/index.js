const const_email = require('../src/helpers/const/const_email');
const crypto = require('crypto');
const fs = require('fs');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const knexfile = require('../knexfile');
const make = require('@vbarbarosh/type-helpers');
const parse_domains = require('../src/helpers/parse_domains');
const resolve_yaml_vars = require('../src/helpers/resolve_yaml_vars');
const yaml = require('yaml');

const knexvars = get_knexvars();

const data_dir = fs_path_resolve(__dirname, '../data');
const logs_dir = fs_path_resolve(__dirname, '../data/logs');
const uploads_dir = fs_path_resolve(__dirname, '../data/uploads');
const secret_key_file = fs_path_resolve(__dirname, '../data/secret.key');
const design_dir = fs_path_resolve(__dirname, '../design');
const emails_dir = fs_path_resolve(__dirname, '../design/emails');

fs.mkdirSync(data_dir, {recursive: true});
fs.mkdirSync(logs_dir, {recursive: true});
fs.mkdirSync(uploads_dir, {recursive: true});

const SECRET = load_secret();

const settings = resolve_yaml_vars(
    yaml.parse(fs.readFileSync(fs_path_resolve(__dirname, 'settings.yaml'), {encoding: 'utf8'})),
    process.env
);

const public_url = process.env.AUTHWALL_PUBLIC_URL ?? 'http://127.0.0.1:3000';

const config = {
    seed_users: Array.from(settings.seed_users||[]),
    public_url,
    public_paths: Array.from(settings.public_paths||[]).filter(v => v && v[0] === '/'),
    target_url: process.env.AUTHWALL_TARGET_URL ?? 'http://127.0.0.1:8080',
    target_mode: make(process.env.AUTHWALL_TARGET_MODE, {type: 'enum', options: ['direct', 'proxy']}),

    emails: {
        [const_email.welcome]: `${emails_dir}/welcome.txt`,
        [const_email.welcome_and_confirm_email]: `${emails_dir}/welcome-and-confirm-email.txt`,

        [const_email.magic_link]: `${emails_dir}/magic-link.txt`,
        [const_email.password_reset]: `${emails_dir}/password-reset.txt`,

        [const_email.confirm_email]: `${emails_dir}/confirm-email.txt`,
        [const_email.email_change_requested]: `${emails_dir}/email-change-request.txt`, // sent to new email with confirm link
        [const_email.email_changed]: `${emails_dir}/email-changed.txt`, // sent to old email: "your email is being changed"

        // notifications
        [const_email.new_sign_in]: `${emails_dir}/new-sign-in.txt`,
        [const_email.google_connected]: `${emails_dir}/google-connected.txt`,
        [const_email.google_disconnected]: `${emails_dir}/google-disconnected.txt`,
        [const_email.github_connected]: `${emails_dir}/github-connected.txt`,
        [const_email.github_disconnected]: `${emails_dir}/github-disconnected.txt`,
        [const_email.password_changed_from_profile]: `${emails_dir}/password-changed-from-profile.txt`,
        [const_email.password_changed_via_reset_link]: `${emails_dir}/password-changed-via-reset-link.txt`,
    },

    pages: {
        // unauthenticated entry
        sign_in: '/auth/sign-in',
        sign_up: '/auth/sign-up',

        // email verification
        email_verify_request: '/auth/email-verify',
        email_verify_confirm: '/auth/email-verify/confirm',
        email_verify_notice: '/auth/email-verify/sent',
        email_verify_success: '/auth/email-verify/success',

        email_change_request: '/auth/email-change/request',
        email_change_confirm: '/auth/email-change/confirm',
        email_change_notice: '/auth/email-change/sent',
        email_change_success: '/auth/email-change/success',

        // password flows
        // password_reset_request: '/forgot-password',
        // password_reset_confirm: '/reset-password',
        password_reset_request: '/auth/password-reset',
        password_reset_confirm: '/auth/password-reset/confirm',
        password_reset_notice: '/auth/password-reset/sent',

        // magic link flow
        magic_link_request: '/auth/magic-link',
        magic_link_confirm: '/auth/magic-link/confirm',
        // **Check your email**
        // A magic link has been sent to foo@bar.com
        // Use the link or enter the code to sign in
        magic_link_notice: '/auth/magic-link/sent',

        // authenticated area
        profile: '/auth/profile',
        sessions: '/auth/sessions',

        // destructive / confirmation
        sign_out: '/auth/sign-out',
    },

    access: {
        denied_emails: parse_domains(settings.access.denied_emails),
        allowed_emails: parse_domains(settings.access.allowed_emails),
        denied_domains: parse_domains(settings.access.denied_domains),
        allowed_domains: parse_domains(settings.access.allowed_domains),
    },

    logger: make(process.env.AUTHWALL_LOGGER, {type: 'enum', options: ['daily', 'stdout']}),
    logs_dir,
    uploads_dir,

    listen: process.env.LISTEN ?? '127.0.0.1',
    port: process.env.PORT ?? 3000,
    secrets: {
        csrf_token: secret_hkdf('csrf_token'),
        express_session: secret_hkdf('express_session'),
    },

    knexvars,
    password_rounds: 12,

    cookie: make(settings.cookie, {
        domain: {type: 'str', after: v => v.trim() || undefined},
        path: {type: 'str', after: v => v.startsWith('/') ? v : '/'},
        same_site: {type: 'enum', options: ['lax', 'strict', 'none']},
        secure: {type: 'bool', default: public_url.startsWith('https://'), before: v => ({yes: 1, no: 0, true: 1, false: 0}[v] ?? v)},
        max_age_days: {type: 'int', min: 1, max: 365, default: 30},
    }),

    flows: make(settings.flows, {
        password: {
            enabled: 'bool',
            allow_username: {type: 'bool', default: true},
            allow_email: {type: 'bool', default: true},
            min_password_length: {type: 'int', min: 4, max: 32, default: 8},
        },
        magic_link: {
            enabled: 'bool',
            mode: {type: 'enum', options: ['link', 'code', 'link_and_code']},
        },
        google: {
            enabled: 'bool',
            client_id: {type: 'str', nullable: true},
            client_secret: {type: 'str', nullable: true},
            redirect_url: {type: 'str', nullable: true},
        },
        github: {
            enabled: 'bool',
            client_id: {type: 'str', nullable: true},
            client_secret: {type: 'str', nullable: true},
            redirect_url: {type: 'str', nullable: true},
        },
    }),

    mailer: make(settings.mailer, {
        enabled: {type: 'bool', default: true},
        provider: {type: 'enum', options: ['auto', 'fake', 'resend', 'mailjet', 'ses']},
        resend: {
            key: {type: 'str', nullable: true},
            from: {type: 'str', nullable: true},
        },
        mailjet: {
            key: {type: 'str', nullable: true},
            secret: {type: 'str', nullable: true},
            from: {type: 'str', nullable: true},
        },
        ses: {
            region: {type: 'str', default: 'us-east-1', before: v => v || undefined},
            key: {type: 'str', nullable: true},
            secret: {type: 'str', nullable: true},
            session_token: {type: 'str', nullable: true},
            from: {type: 'str', nullable: true},
        },
    }),
};

if (config.flows.password.enabled) {
    const {allow_username, allow_email} = config.flows.password;
    if (!allow_username && !allow_email) {
        config.flows.password.enabled = false;
    }
}

if (config.flows.google.enabled) {
    const {client_id, client_secret, redirect_url} = config.flows.google;
    if (!client_id || !client_secret || !redirect_url) {
        config.flows.google.enabled = false;
        if (client_id || client_secret || redirect_url) {
            console.warn('⚠️  Google OAuth disabled: client_id, client_secret, and redirect_url must all be set');
        }
    }
}

if (config.flows.github.enabled) {
    const {client_id, client_secret, redirect_url} = config.flows.github;
    if (!client_id || !client_secret || !redirect_url) {
        config.flows.github.enabled = false;
        if (client_id || client_secret || redirect_url) {
            console.warn('⚠️  GitHub OAuth disabled: client_id, client_secret, and redirect_url must all be set');
        }
    }
}

if (config.cookie.same_site === 'none' && !config.cookie.secure) {
    throw new Error('cookie.same_site=none requires cookie.secure=true');
}

validate_mailer(config.mailer);

function secret_hkdf(namespace)
{
    return Buffer.from(crypto.hkdfSync('sha256', SECRET, 'authwall', namespace, 32)).toString('base64url');
}

function load_secret()
{
    if (process.env.AUTHWALL_SECRET) {
        validate_secret(process.env.AUTHWALL_SECRET, 'AUTHWALL_SECRET');
        return process.env.AUTHWALL_SECRET;
    }

    try {
        const secret = fs.readFileSync(secret_key_file, {encoding: 'utf8'}).trim();
        validate_secret(secret, secret_key_file);
        return secret;
    }
    catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }

    const secret = crypto.randomBytes(32).toString('base64url');
    try {
        fs.writeFileSync(secret_key_file, `${secret}\n`, {encoding: 'utf8', mode: 0o600, flag: 'wx'});
        return secret;
    }
    catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
        const existing_secret = fs.readFileSync(secret_key_file, {encoding: 'utf8'}).trim();
        validate_secret(existing_secret, secret_key_file);
        return existing_secret;
    }
}

function validate_secret(secret, source)
{
    if (secret.length < 32) {
        throw new Error(`${source} must be at least 32 characters`);
    }
}

function validate_mailer(mailer)
{
    if (!mailer.enabled) {
        return;
    }

    if (mailer.provider === 'auto' || mailer.provider === 'fake') {
        return;
    }

    if (mailer.provider === 'resend') {
        if (!mailer.resend.key || !mailer.resend.from) {
            throw new Error('mailer.provider=resend requires mailer.resend.key and mailer.resend.from');
        }
        return;
    }

    if (mailer.provider === 'mailjet') {
        if (!mailer.mailjet.key || !mailer.mailjet.secret || !mailer.mailjet.from) {
            throw new Error('mailer.provider=mailjet requires mailer.mailjet.key, mailer.mailjet.secret, and mailer.mailjet.from');
        }
        return;
    }

    if (mailer.provider === 'ses') {
        if (!mailer.ses.key || !mailer.ses.secret || !mailer.ses.from) {
            throw new Error('mailer.provider=ses requires mailer.ses.key, mailer.ses.secret, and mailer.ses.from');
        }
    }

    throw new Error(`Invalid mailer.provider: ${mailer.provider}`);
}

function get_knexvars()
{
    const db = process.env.AUTHWALL_DB;
    if (!db) {
        return knexfile.sqlite;
    }

    if (db.startsWith('mysql://')) {
        return knexfile.mysql;
    }

    if (db.startsWith('postgres://') || db.startsWith('postgresql://')) {
        return knexfile.postgres;
    }

    throw new Error('AUTHWALL_DB must use mysql://, postgres://, or postgresql://');
}

module.exports = config;
