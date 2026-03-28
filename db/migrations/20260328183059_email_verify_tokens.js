/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('email_verify_tokens', function (table) {
        table.increments('id');
        table.integer('user_id').unsigned().notNullable().index().references('id').inTable('users').onDelete('RESTRICT');
        table.string('email_normalized', 255).notNullable().collate('utf8mb4_bin');
        table.string('token_hash', 64).notNullable().unique();
        table.timestamp('created_at').notNullable();
        table.timestamp('updated_at').notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('used_at').nullable();
        // Rate-limit: prevent spamming verification emails
        table.index(['email_normalized', 'created_at']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('email_verify_tokens');
};
