/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('magic_links', function (table) {
        table.increments('id');
        table.string('email', 255).notNullable();
        table.string('email_normalized', 255).notNullable().index();
        table.string('code_hash', 255);
        table.string('token_hash', 64).notNullable().unique();
        table.timestamp('created_at').notNullable();
        table.timestamp('updated_at').notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('used_at').nullable();
        // To prevent spamming email requests: last email sent in 5 minutes
        table.index(['email_normalized', 'created_at']);
      });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('magic_links');
};
