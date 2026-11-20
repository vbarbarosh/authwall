const fs = require('fs');
const knex = require('knex');

// A knex instance for these settings. A SQLite file that does not exist yet
// is made here first, readable by its owner only: SQLite would make it with
// the process umask, 0644 under the usual 022, and every user of the machine
// could read the password hashes and addresses in it (AW-169). An existing
// file keeps its mode.
function db_from_knexvars(knexvars)
{
    if (knexvars.connection?.filename) {
        sqlite_file_create(knexvars.connection.filename);
    }
    return knex(knexvars);
}

function sqlite_file_create(filename)
{
    try {
        fs.closeSync(fs.openSync(filename, 'wx', 0o600));
    }
    catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

module.exports = db_from_knexvars;
