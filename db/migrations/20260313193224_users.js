/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('users', function (table) {
        table.increments('id');
        table.string('uid', 32).notNullable().unique().collate('utf8mb4_bin');
        table.string('username', 100).unique();
        table.string('email', 255).unique();
        table.boolean('email_verified').notNullable().defaultTo(false);
        table.string('password_hash', 255);
        table.string('display_name', 255);
        table.string('avatar_url', 500);
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('users');
};
