/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('sessions', function (table) {
        table.string('session_id', 128).primary();
        table.json('data').notNullable();
        table.bigInteger('expires').notNullable().index();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('sessions');
};
