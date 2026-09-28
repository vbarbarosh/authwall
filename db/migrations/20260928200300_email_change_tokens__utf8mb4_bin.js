const utf8mb4_bin = require('../utf8mb4_bin');

// MySQL only. token_hash is looked up by value but was created with the
// server's default collation, which ignores case and accents (AW-23).

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    if (knex.client.config.custom.name !== 'mysql') {
        return;
    }
    await knex.schema.alterTable('email_change_tokens', function (table) {
        utf8mb4_bin(table.string('token_hash', 64).notNullable()).alter();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    if (knex.client.config.custom.name !== 'mysql') {
        return;
    }
    await knex.schema.alterTable('email_change_tokens', function (table) {
        table.string('token_hash', 64).notNullable().alter();
    });
};
