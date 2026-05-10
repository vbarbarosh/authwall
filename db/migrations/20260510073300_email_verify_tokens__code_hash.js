/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.table('email_verify_tokens', function (table) {
        table.string('code_hash', 255).nullable().after('token_hash');
        table.integer('attempts').notNullable().defaultTo(0).after('code_hash');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.table('email_verify_tokens', function (table) {
        table.dropColumn('attempts');
        table.dropColumn('code_hash');
    });
};
