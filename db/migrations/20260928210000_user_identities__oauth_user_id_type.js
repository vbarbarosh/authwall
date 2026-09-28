// One account per OAuth provider per user (AW-24). Email identities are left
// out: connecting a provider may add its verified address next to the account's.
// MySQL has no partial index, so it indexes a generated column that is NULL
// for every other type; NULLs never collide in a unique index.

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    if (knex.client.config.custom.name === 'mysql') {
        await knex.raw(`alter table user_identities
            add column oauth_user_id int unsigned generated always as (if(type like 'oauth\\\\_%', user_id, null)) virtual after user_id,
            add unique index user_identities_oauth_user_id_type_unique (oauth_user_id, type)`);
        return;
    }
    await knex.raw('create unique index user_identities_oauth_user_id_type_unique on user_identities (user_id, type) where type like \'oauth\\_%\' escape \'\\\'');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    if (knex.client.config.custom.name === 'mysql') {
        await knex.raw('alter table user_identities drop index user_identities_oauth_user_id_type_unique, drop column oauth_user_id');
        return;
    }
    await knex.raw('drop index user_identities_oauth_user_id_type_unique');
};
