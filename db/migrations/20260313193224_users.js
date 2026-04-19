const utf8mb4_bin = require('../utf8mb4_bin');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('users', function (table) {
        table.increments('id');
        utf8mb4_bin(table.string('uid', 32).notNullable());
        utf8mb4_bin(table.string('slug', 32).notNullable().comment('uid for urls'));
        table.string('password_hash', 255).nullable();
        table.string('display_name', 255).nullable();
        table.string('avatar_url', 500).nullable();

        // dates
        table.timestamp('created_at').notNullable();
        table.timestamp('updated_at').notNullable();

        // constraints
        table.unique(['uid']);
        table.unique(['slug']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('users');
};
