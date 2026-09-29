// The account's primary address (AW-24): the first verified address it came
// in with. At most one per user; MySQL has no partial index, so it indexes a
// generated column that is NULL for every other row.

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('user_identities', function (table) {
        table.datetime('primary_at').nullable().after('verified_at');
    });
    // Existing accounts: the oldest verified address. The derived table lets
    // MySQL read the table it updates.
    await knex.raw(`update user_identities set primary_at = verified_at where id in (
        select id from (select min(id) as id from user_identities where type = 'email' and verified_at is not null group by user_id) as oldest
    )`);
    if (knex.client.config.custom.name === 'mysql') {
        await knex.raw(`alter table user_identities
            add column primary_user_id int unsigned generated always as (if(primary_at is null, null, user_id)) virtual after primary_at,
            add unique index user_identities_primary_user_id_unique (primary_user_id)`);
        return;
    }
    await knex.raw('create unique index user_identities_primary_user_id_unique on user_identities (user_id) where primary_at is not null');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    if (knex.client.config.custom.name === 'mysql') {
        await knex.raw('alter table user_identities drop index user_identities_primary_user_id_unique, drop column primary_user_id');
    }
    else {
        await knex.raw('drop index user_identities_primary_user_id_unique');
    }
    await knex.schema.alterTable('user_identities', function (table) {
        table.dropColumn('primary_at');
    });
};
