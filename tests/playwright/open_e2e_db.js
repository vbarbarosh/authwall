const knex = require('knex');
const knexfile = require('../../knexfile');
const os = require('os');
const path = require('path');

// The database the e2e server was started on (see playwright.config.js), opened
// with the app's own settings for it (knexfile.js): on MySQL its UTC timezone,
// so a time a test writes is the time the app reads, whatever the machine's zone.
function open_e2e_db()
{
    const url = process.env.AUTHWALL_DB ?? `sqlite://${path.join(os.tmpdir(), 'authwall-e2e.sqlite3')}`;
    const vars = url.startsWith('sqlite://')
        ? {client: 'better-sqlite3', connection: {filename: url.slice('sqlite://'.length)}, useNullAsDefault: true}
        : (url.startsWith('mysql://') ? knexfile.mysql : knexfile.postgres);
    const db = knex(vars);
    db[Symbol.asyncDispose] = function () {
        return db.destroy();
    };
    return db;
}

module.exports = open_e2e_db;
