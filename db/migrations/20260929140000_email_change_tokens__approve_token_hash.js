const utf8mb4_bin = require('../utf8mb4_bin');

// A change of the primary address needs the current primary's approval before
// the new address is asked to confirm (primary_change_needs_both_addresses.md).
// Requests pending at migration time stay unapproved and expire.

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('email_change_tokens', function (table) {
        utf8mb4_bin(table.string('approve_token_hash', 64).nullable().after('token_hash').comment('SHA256 of the link mailed to the current primary'));
        table.datetime('approved_at').nullable().after('approve_token_hash');
        table.unique(['approve_token_hash']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.alterTable('email_change_tokens', function (table) {
        table.dropUnique(['approve_token_hash']);
        table.dropColumn('approved_at');
        table.dropColumn('approve_token_hash');
    });
};
