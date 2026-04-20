const utf8mb4_bin = require('../utf8mb4_bin');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('auth_events', function (table) {
        table.increments('id');
        utf8mb4_bin(table.string('uid', 32).notNullable());
        table.integer('user_id').unsigned().nullable();
        utf8mb4_bin(table.string('session_uid', 32).nullable());
        utf8mb4_bin(table.string('event_type', 64).notNullable().comment('Events must describe intent (sign_in), not mechanics (session replaced)'));
        utf8mb4_bin(table.string('event_status', 32).notNullable().comment('Result of the event: success | failure | noop'));
        utf8mb4_bin(table.string('identity_type', 32).nullable());
        table.string('identity_value', 255).nullable();
        utf8mb4_bin(table.string('identity_value_normalized', 255).nullable());
        table.string('ip', 64).nullable();
        table.string('ua', 512).nullable();
        table.text('custom').nullable();

        // dates
        table.timestamp('created_at').notNullable();

        // constraints
        table.unique(['uid']);

        // foreign keys
        table.foreign('user_id').references('id').inTable('users').onDelete('RESTRICT');

        // indexes
        table.index(['user_id']);
        table.index(['session_uid']);
        table.index(['event_type']);
        table.index(['event_status']);
        table.index(['identity_type']);
        table.index(['created_at']);

        // composite indexes
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
