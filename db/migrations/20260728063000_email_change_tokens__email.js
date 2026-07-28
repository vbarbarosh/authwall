/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.table('email_change_tokens', function (table) {
        table.string('email', 255).nullable().after('user_id').comment('Value as entered by the user; email_normalized is the canonical form used for matching');
    });
    // Pending changes requested before this column existed only carry the
    // normalized form; it is the best display value available for them.
    await knex('email_change_tokens').whereNull('email').update({email: knex.ref('email_normalized')});
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.table('email_change_tokens', function (table) {
        table.dropColumn('email');
    });
};
