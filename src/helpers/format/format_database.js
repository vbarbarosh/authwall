const redact_url_password = require('../redact_url_password');

// The database a knex configuration opens, as an operator names it: its
// label, then the file or the URL without its password.
function format_database(knexvars)
{
    const label = knexvars.custom?.label || knexvars.custom?.name || knexvars.client;
    const connection = knexvars.connection;
    if (typeof connection === 'string') {
        return `${label} ${redact_url_password(connection)}`;
    }
    if (connection?.uri) {
        return `${label} ${redact_url_password(connection.uri)}`;
    }
    if (connection?.filename) {
        return `${label} ${connection.filename}`;
    }
    return label;
}

module.exports = format_database;
