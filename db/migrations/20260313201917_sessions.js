/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('sessions', function (table) {
        table.increments('id');
        table.string('uid', 32).notNullable().unique().collate('utf8mb4_bin');
        table.integer('user_id').unsigned().nullable().index().references('id').inTable('users').onDelete('RESTRICT');
        table.string('user_uid', 32).nullable().collate('utf8mb4_bin');
        table.string('ip', 64).notNullable();
        table.string('ua', 512).notNullable().comment('User Agent');
        table.text('custom').notNullable();
        table.timestamp('created_at').notNullable();
        table.timestamp('updated_at').notNullable();
        table.timestamp('expires_at').notNullable().index();
        table.timestamp('last_seen_at').notNullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('sessions');
};
