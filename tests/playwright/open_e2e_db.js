const knex = require('knex');
const os = require('os');
const path = require('path');

// The database the e2e server was started on (see playwright.config.js).
function open_e2e_db()
{
    const url = process.env.AUTHWALL_DB ?? `sqlite://${path.join(os.tmpdir(), 'authwall-e2e.sqlite3')}`;
    const vars = url.startsWith('sqlite://')
        ? {client: 'better-sqlite3', connection: {filename: url.slice('sqlite://'.length)}, useNullAsDefault: true}
        : {client: url.startsWith('mysql://') ? 'mysql2' : 'pg', connection: url};
    const db = knex(vars);
    db[Symbol.asyncDispose] = function () {
        return db.destroy();
    };
    return db;
}

module.exports = open_e2e_db;
