// The addresses a provider vouched for at its account's last sign-in, a JSON
// array of normalized addresses (AW-120). An account that keeps no address of
// its own meets the email access rules with them at every door, as its
// sign-in did. NULL until that sign-in: under the rules, such an account
// signs in once more.

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('user_identities', function (table) {
        table.text('provider_emails').nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.alterTable('user_identities', function (table) {
        table.dropColumn('provider_emails');
    });
};
