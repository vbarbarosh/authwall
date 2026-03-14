const fs = require('fs');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const knexfile = require('../../knexfile');

const NODE_ENV = process.env.NODE_ENV ?? 'development';

if (!knexfile[NODE_ENV]) {
    throw new Error(`Invalid NODE_ENV: ${NODE_ENV}`);
}

if (knexfile[NODE_ENV].connection?.filename) {
    fs.mkdirSync(fs_path_resolve(__dirname, '../../data'), {recursive: true});
}

let log_dir = null;
const log_file = process.env.LOG_FILE ?? null;

const config = {
    log_file,
    log_file_http: log_file ?? function () {
        if (log_dir === null) {
            log_dir = fs_path_resolve(__dirname, '../../data/logs');
            fs.mkdirSync(log_dir, {recursive: true});
        }
        return `${log_dir}/http-${new Date().toJSON().substring(0, 10)}.log`;
    },
    listen: process.env.LISTEN ?? 'localhost',
    port: process.env.PORT ?? 3000,
    session_secret: process.env.AUTHWALL_SESSION_SECRET ?? '___AUTHWALL_SESSION_SECRET___',
    target: process.env.AUTHWALL_TARGET ?? 'http://localhost:8080',
    mysql: process.env.AUTHWALL_MYSQL,
    knexvars: {
        ...knexfile[NODE_ENV],
        connection: process.env.AUTHWALL_MYSQL ?? knexfile[NODE_ENV].connection,
    },
    password_rounds: 12,
};

if (!process.env.AUTHWALL_SESSION_SECRET) {
    console.warn('\n⚠️ Missing required env var: AUTHWALL_SESSION_SECRET\n');
}

module.exports = config;
