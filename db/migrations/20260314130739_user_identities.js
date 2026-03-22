/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('user_identities', function (table) {
        table.increments('id');
        table.integer('user_id').unsigned().notNullable().index().references('id').inTable('users').onDelete('RESTRICT');
        // table.enum('type', ['username', 'email', 'google', 'apple', 'microsoft', 'phone']).notNullable();
        table.string('type', 32).notNullable().collate('utf8mb4_bin');
        table.string('value', 255).nullable().comment('Original value, but some providers (like Google OAuth) has nothing meaningful for this field');
        table.string('value_normalized', 255).notNullable().collate('utf8mb4_bin');
        table.timestamp('created_at').notNullable();
        table.timestamp('updated_at').notNullable();
        table.timestamp('verified_at').nullable().index();
        // prevent the same username linking to multiple users
        // prevent the same email linking to multiple users
        // prevent the same Google account linking to multiple users
        table.unique(['type', 'value_normalized'])
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('user_identities');
};
