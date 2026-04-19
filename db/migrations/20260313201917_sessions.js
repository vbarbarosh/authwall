const utf8mb4_bin = require('../utf8mb4_bin');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('sessions', function (table) {
        table.increments('id');
        utf8mb4_bin(table.string('uid', 32).notNullable());
        table.integer('user_id').unsigned().nullable();
        utf8mb4_bin(table.string('user_uid', 32).nullable());
        table.string('ip', 64).notNullable();
        table.string('ua', 512).notNullable().comment('User Agent');

        // custom
        table.text('custom').notNullable();

        // dates
        table.timestamp('created_at').notNullable();
        table.timestamp('updated_at').notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('last_seen_at').notNullable();

        // constraints
        table.unique(['uid']);

        // foreign keys
        table.foreign('user_id').references('id').inTable('users').onDelete('RESTRICT');

        // indexes
        table.index(['user_id']);
        table.index(['expires_at']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('sessions');
};
