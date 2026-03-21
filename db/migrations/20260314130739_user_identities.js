/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('user_identities', function (table) {
        table.increments('id');
        table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT');
        table.string('provider', 100).notNullable();
        table.string('provider_user_id', 100).notNullable();
        table.timestamp('created_at').notNullable();
        // prevent the same Google account linking to multiple users
        table.unique(['provider', 'provider_user_id'])
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('user_identities');
};
