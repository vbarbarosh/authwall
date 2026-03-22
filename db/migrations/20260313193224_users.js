/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('users', function (table) {
        table.increments('id');
        table.string('uid', 32).notNullable().unique().collate('utf8mb4_bin');
        table.string('slug', 32).notNullable().unique().collate('utf8mb4_bin').comment('uid for urls');
        // table.string('username', 100).unique();
        // table.string('email', 255).unique();
        // table.boolean('email_verified').notNullable().defaultTo(false);
        table.string('password_hash', 255).nullable();
        table.string('display_name', 255).nullable();
        table.string('avatar_url', 500).nullable();
        table.timestamp('created_at').notNullable();
        table.timestamp('updated_at').notNullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('users');
};
