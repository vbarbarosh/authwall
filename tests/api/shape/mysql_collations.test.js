const assert = require('assert');
const config = require('../../../config');
const db = require('../../../db');

// Every column the app looks up by value must compare byte for byte; the
// server's default collation ignores case and accents (AW-23).
const COLUMNS = [
    'email_change_tokens.email_normalized',
    'email_change_tokens.token_hash',
    'email_verify_tokens.email_normalized',
    'email_verify_tokens.token_hash',
    'magic_links.email_normalized',
    'magic_links.token_hash',
    'password_reset_tokens.token_hash',
    'personal_access_tokens.token_hash',
    'user_identities.value_normalized',
];

describe('MySQL collations | shape', function () {

    it('uses utf8mb4_bin for every column looked up by value', async function () {
        if (config.knexvars.custom.name !== 'mysql') {
            this.skip();
        }
        const rows = await db('information_schema.columns')
            .select('table_name as table_name', 'column_name as column_name', 'collation_name as collation_name')
            .whereRaw('table_schema = database()')
            .whereIn(db.raw('concat(table_name, \'.\', column_name)'), COLUMNS);
        const actual = Object.fromEntries(rows.map(v => [`${v.table_name}.${v.column_name}`, v.collation_name]));
        assert.deepStrictEqual(actual, Object.fromEntries(COLUMNS.map(v => [v, 'utf8mb4_bin'])));
    });

});
