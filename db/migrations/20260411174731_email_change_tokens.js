const utf8mb4_bin = require('../utf8mb4_bin');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('email_change_tokens', function (table) {
        table.increments('id');
        table.integer('user_id').unsigned().notNullable();
        utf8mb4_bin(table.string('email_normalized', 255).notNullable());
        table.string('token_hash', 64).notNullable();

        // dates
        table.datetime('created_at').notNullable();
        table.datetime('updated_at').notNullable();
        table.datetime('expires_at').notNullable();
        table.datetime('used_at').nullable();

        // constraints
        table.unique(['token_hash']);

        // foreign keys
        table.foreign('user_id').references('id').inTable('users').onDelete('RESTRICT');

        // indexes
        table.index(['user_id']);

        // composite indexes
        // Rate-limit: prevent spamming email change requests
        table.index(['email_normalized', 'created_at']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('email_change_tokens');
};
