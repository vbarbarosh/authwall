const crypto = require('crypto');
const fs = require('fs');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const knexfile = require('../knexfile');

const NODE_ENV = process.env.NODE_ENV ?? 'development';

if (!knexfile[NODE_ENV]) {
    throw new Error(`Invalid NODE_ENV: ${NODE_ENV}`);
}

if (knexfile[NODE_ENV].connection?.filename) {
    fs.mkdirSync(fs_path_resolve(__dirname, '../../data'), {recursive: true});
}

let LOG_DIR = null;
const LOG_FILE = process.env.LOG_FILE ?? null;
const SECRET = process.env.AUTHWALL_SECRET ?? 'demo_demo_demo_demo_demo_demo_demo';

const config = {
    users_file: fs_path_resolve(__dirname, 'users.txt'),
    public_url: process.env.AUTHWALL_PUBLIC_URL ?? 'http://127.0.0.1:3000',
    public_paths: fs.readFileSync(fs_path_resolve(__dirname, 'public_paths.txt'), {encoding: 'utf8'}).split('\n').map(v => v.trim()).filter(v => v && v[0] === '/'),
    target_url: process.env.AUTHWALL_TARGET_URL ?? 'http://127.0.0.1:8080',
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
    knexvars: {
        ...knexfile[NODE_ENV],
        connection: process.env.AUTHWALL_MYSQL || knexfile[NODE_ENV].connection,
    },
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
