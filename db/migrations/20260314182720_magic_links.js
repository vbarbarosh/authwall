/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('magic_links', function (table) {
        table.increments('id');
        table.string('email', 255).notNullable();
        table.string('email_normalized', 255).notNullable();
        table.string('code_hash', 255);
        table.string('token_hash', 64).notNullable();
        table.integer('attempts').notNullable().defaultTo(0);

        // dates
        table.datetime('created_at').notNullable();
        table.datetime('updated_at').notNullable();
        table.datetime('expires_at').notNullable();
        table.datetime('used_at').nullable();

        // constraints
        table.unique(['token_hash']);

        // indexes
        table.index(['email_normalized']);

        // composite indexes
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
