const utf8mb4_bin = require('../utf8mb4_bin');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('auth_events', function (table) {
        table.increments('id');
        utf8mb4_bin(table.string('uid', 32).notNullable().unique());
        table.integer('user_id').unsigned().nullable().index().references('id').inTable('users').onDelete('RESTRICT');
        utf8mb4_bin(table.string('session_uid', 32).nullable().index());
        utf8mb4_bin(table.string('event_type', 64).notNullable().index());
        utf8mb4_bin(table.string('event_status', 32).notNullable().index());
        utf8mb4_bin(table.string('identity_type', 32).nullable().index());
        table.string('identity_value', 255).nullable();
        utf8mb4_bin(table.string('identity_value_normalized', 255).nullable());
        table.string('ip', 64).nullable();
        table.string('ua', 512).nullable().comment('User Agent');
        table.text('custom').notNullable();
        table.timestamp('created_at').notNullable().index();

        table.index(['user_id', 'created_at']);
        table.index(['event_type', 'created_at']);
        table.index(['identity_type', 'identity_value_normalized']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('auth_events');
};
