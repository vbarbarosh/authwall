const MARK_TABLE = 'test_database_mark';

// The suites migrate, seed and empty the database they run on. They take
// only one they made, known by its mark, or an empty one, marked now. One
// holding tables without the mark is someone's data: the run stops before
// it changes a row (AW-105).
async function spin_test_database(db)
{
    if (await db.schema.hasTable(MARK_TABLE)) {
        return;
    }
    for (const table of ['knex_migrations', 'users']) {
        if (await db.schema.hasTable(table)) {
            const name = db.client.config.connection?.filename ?? `the ${db.client.config.custom.label} database`;
            throw new Error(`Refused: ${name} holds the table "${table}" and no "${MARK_TABLE}", so the test suites did not make it. Name an empty database in AUTHWALL_DB, unset it for a temporary SQLite file, or delete a test file an older run left.`);
        }
    }
    await db.schema.createTable(MARK_TABLE, function (table) {
        table.datetime('created_at').notNullable();
    });
    await db(MARK_TABLE).insert({created_at: new Date()});
}

module.exports = spin_test_database;
