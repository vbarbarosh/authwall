const crypto = require('crypto');
const fs = require('fs');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const knexfile = require('../knexfile');
const yaml = require('yaml');

const AUTHWALL_MYSQL = process.env.AUTHWALL_MYSQL;

const knexvars = AUTHWALL_MYSQL ? knexfile.mysql : knexfile.sqlite;

if (knexvars.connection?.filename) {
    fs.mkdirSync(fs_path_resolve(__dirname, '../data'), {recursive: true});
}

let LOG_DIR = null;
const LOG_FILE = process.env.LOG_FILE ?? null;
const SECRET = process.env.AUTHWALL_SECRET ?? 'demo_demo_demo_demo_demo_demo_demo';

const settings = yaml.parse(fs.readFileSync(fs_path_resolve(__dirname, 'settings.yaml'), {encoding: 'utf8'}));

const config = {
    seed_users: Array.from(settings.seed_users||[]),
    public_url: process.env.AUTHWALL_PUBLIC_URL ?? 'http://127.0.0.1:3000',
    public_paths: Array.from(settings.public_paths||[]).filter(v => v && v[0] === '/'),
    target_url: process.env.AUTHWALL_TARGET_URL ?? 'http://127.0.0.1:8080',

    pages: {
        // unauthenticated entry
        sign_in: '/auth/sign-in',
        sign_up: '/auth/sign-up',

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
        sign_out: '/auht/sign-out',
    },

    log_file: LOG_FILE,
    log_file_http: LOG_FILE ?? function () {
        if (LOG_DIR === null) {
            LOG_DIR = fs_path_resolve(__dirname, '../../data/logs');
            fs.mkdirSync(LOG_DIR, {recursive: true});
        }
        return `${LOG_DIR}/http-${new Date().toJSON().substring(0, 10)}.log`;
    },
    listen: process.env.LISTEN ?? '127.0.0.1',
    port: process.env.PORT ?? 3000,
    secrets: {
        csrf_token: secret_hkdf('csrf_token'),
        express_session: secret_hkdf('express_session'),
    },
    mysql: process.env.AUTHWALL_MYSQL,
    knexvars,
    password_rounds: 12,

    // Google Login
    google_client_id: process.env.AUTHWALL_GOOGLE_CLIENT_ID,
    google_client_secret: process.env.AUTHWALL_GOOGLE_CLIENT_SECRET,
    google_redirect_url: process.env.AUTHWALL_GOOGLE_REDIRECT_URL,
};

if (!process.env.AUTHWALL_SECRET) {
    console.warn('\n⚠️ Missing required env var: AUTHWALL_SECRET\n');
}

function secret_hkdf(namespace)
{
    return Buffer.from(crypto.hkdfSync('sha256', SECRET, 'authwall', namespace, 32)).toString('hex');
}

module.exports = config;
