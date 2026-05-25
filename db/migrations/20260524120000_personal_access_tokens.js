const utf8mb4_bin = require('../utf8mb4_bin');

exports.up = async function (knex) {
    await knex.schema.createTable('personal_access_tokens', function (table) {
        table.increments('id');
        utf8mb4_bin(table.string('uid', 32).notNullable().comment('public id used in URLs / revoke UI'));
        table.integer('user_id').unsigned().notNullable();

        // What the user sees
        table.string('label', 100).notNullable().comment('user-supplied label, e.g. "My Laptop"');

        // The secret - store only the hash
        utf8mb4_bin(table.string('token_hash', 64).notNullable().comment('SHA256(token). Raw token shown once at creation.'));
        utf8mb4_bin(table.string('token_prefix', 16).notNullable().comment('first chars of token, shown in UI for recognition'));

        // Lifecycle
        table.datetime('created_at').notNullable();
        table.datetime('updated_at').notNullable();
        table.datetime('expires_at').nullable().comment('NULL = never expires');
        table.datetime('last_used_at').nullable();
        table.datetime('revoked_at').nullable();

        // Bookkeeping for the "last used" display
        table.string('last_used_ip', 45).nullable();
        table.string('last_used_ua', 512).nullable();

        // constraints
        table.unique(['uid']);
        table.unique(['token_hash']);
        table.foreign('user_id').references('id').inTable('users').onDelete('RESTRICT');

        // indexes
        table.index(['user_id']);
        table.index(['user_id', 'revoked_at']);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTable('personal_access_tokens');
};
