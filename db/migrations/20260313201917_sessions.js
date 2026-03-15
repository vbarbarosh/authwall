/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('sessions', function (table) {
        table.increments('id');
        table.string('uid', 32).notNullable().unique().collate('utf8mb4_bin');
        table.integer('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
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
