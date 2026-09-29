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
    await knex.raw(`
        UPDATE
            user_identities
        SET
            primary_at = verified_at
        WHERE id IN (
            SELECT id FROM (
                SELECT MIN(id) AS id
                FROM user_identities
                WHERE type = 'email' AND verified_at IS NOT NULL GROUP BY user_id
            ) AS oldest
        )
    `);
    if (knex.client.config.custom.name === 'mysql') {
        await knex.raw(`
            ALTER TABLE
                user_identities
            ADD COLUMN
                primary_user_id INT UNSIGNED GENERATED ALWAYS AS (IF(primary_at IS NULL, NULL, user_id)) VIRTUAL AFTER primary_at,
            ADD UNIQUE INDEX
                user_identities_primary_user_id_unique (primary_user_id)
        `);
        return;
    }
    await knex.raw(`
        CREATE UNIQUE INDEX
            user_identities_primary_user_id_unique
        ON
            user_identities (user_id)
        WHERE
            primary_at IS NOT NULL
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    if (knex.client.config.custom.name === 'mysql') {
        await knex.raw(`
            ALTER TABLE
                user_identities
            DROP INDEX
                user_identities_primary_user_id_unique,
            DROP COLUMN
                primary_user_id
        `);
    }
    else {
        await knex.raw(`
            DROP INDEX
                user_identities_primary_user_id_unique
        `);
    }
    await knex.schema.alterTable('user_identities', function (table) {
        table.dropColumn('primary_at');
    });
};
