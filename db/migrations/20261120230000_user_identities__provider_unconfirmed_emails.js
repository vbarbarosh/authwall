// The addresses a provider gave at its account's last sign-in without
// confirming them, a JSON array of normalized addresses, kept apart from
// provider_emails, the ones it confirmed (AW-170). Only Facebook gives such
// an address, and never a confirmed one (AW-05): a Facebook row's list moves
// here, and its provider_emails is left empty.

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('user_identities', function (table) {
        table.text('provider_unconfirmed_emails').nullable();
    });
    await knex('user_identities')
        .where({type: 'oauth_facebook'})
        .whereNotNull('provider_emails')
        .update({provider_unconfirmed_emails: knex.ref('provider_emails')});
    await knex('user_identities')
        .where({type: 'oauth_facebook'})
        .whereNotNull('provider_unconfirmed_emails')
        .update({provider_emails: '[]'});
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex('user_identities')
        .whereNotNull('provider_unconfirmed_emails')
        .whereNot({provider_unconfirmed_emails: '[]'})
        .update({provider_emails: knex.ref('provider_unconfirmed_emails')});
    await knex.schema.alterTable('user_identities', function (table) {
        table.dropColumn('provider_unconfirmed_emails');
    });
};
