const utf8mb4_bin = require('../utf8mb4_bin');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('user_identities', function (table) {
        table.increments('id');
        utf8mb4_bin(table.string('uid', 32).notNullable());
        table.integer('user_id').unsigned().notNullable();
        utf8mb4_bin(table.string('type', 32).notNullable());
        table.string('value', 255).nullable().comment('Original value, but some providers (like Google OAuth) has nothing meaningful for this field');
        utf8mb4_bin(table.string('value_normalized', 255).notNullable());

        // dates
        table.datetime('created_at').notNullable();
        table.datetime('updated_at').notNullable();
        table.datetime('verified_at').nullable();

        // unique
        table.unique(['uid']);
        // prevent the same username linking to multiple users
        // prevent the same email linking to multiple users
        // prevent the same Google account linking to multiple users
        table.unique(['type', 'value_normalized']);

        // foreign keys
        table.foreign('user_id').references('id').inTable('users').onDelete('RESTRICT');

        // indexes
        table.index(['user_id']);
        table.index(['verified_at']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('user_identities');
};
