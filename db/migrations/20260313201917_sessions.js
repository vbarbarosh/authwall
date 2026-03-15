/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('sessions', function (table) {
        table.increments('id');
        table.string('uid', 32).notNullable().unique().collate('utf8mb4_bin');
        table.integer('user_id').nullable().references('id').inTable('users').onDelete('RESTRICT');
        table.text('custom').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('expires_at').notNullable().index();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('sessions');
};
