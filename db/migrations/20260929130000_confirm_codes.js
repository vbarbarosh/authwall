const utf8mb4_bin = require('../utf8mb4_bin');

// Codes mailed to the primary address when the owner must confirm it is them
// (AW-24): before a provider account that does not use the primary is linked.

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('confirm_codes', function (table) {
        table.increments('id');
        table.integer('user_id').unsigned().notNullable();
        utf8mb4_bin(table.string('email_normalized', 255).notNullable().comment('The primary address the code was mailed to'));
        table.string('code_hash', 255).notNullable();
        table.integer('attempts').notNullable().defaultTo(0);

        // dates
        table.datetime('created_at').notNullable();
        table.datetime('updated_at').notNullable();
        table.datetime('expires_at').notNullable();
        table.datetime('used_at').nullable();

        // foreign keys
        table.foreign('user_id').references('id').inTable('users').onDelete('RESTRICT');

        // composite indexes
        // The latest code of a user, and the resend cooldown
        table.index(['user_id', 'created_at']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('confirm_codes');
};
