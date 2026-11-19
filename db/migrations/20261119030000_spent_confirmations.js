const utf8mb4_bin = require('../utf8mb4_bin');

// Each confirmation spent, once (AW-107): two requests that spend the same one
// at the same moment both insert its hash, and the unique index lets only one
// through. A row is kept for the ten minutes a confirmation lasts.

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('spent_confirmations', function (table) {
        table.increments('id');
        utf8mb4_bin(table.string('confirmation_hash', 64).notNullable().comment('sha256 of the session uid and its confirmed_at'));

        // dates
        table.datetime('created_at').notNullable();

        // unique
        table.unique(['confirmation_hash']);

        // indexes
        table.index(['created_at']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('spent_confirmations');
};
