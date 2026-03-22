/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('password_reset_tokens', function (table) {
        table.increments('id');
        table.integer('user_id').unsigned().notNullable().index().references('id').inTable('users').onDelete('RESTRICT');
        table.string('token_hash', 64).notNullable().unique().comment('Store only SHA256(token). If DB leaks, reset links cannot be used.');
        table.timestamp('created_at').notNullable();
        table.timestamp('updated_at').notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('used_at');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('password_reset_tokens');
};
