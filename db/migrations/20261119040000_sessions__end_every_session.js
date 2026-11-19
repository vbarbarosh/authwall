// Every session ends once, here: 1.17 renamed the cookie from connect.sid to
// authwall.sid but kept the sessions, so an old connect.sid value, sent back
// under the new name, still signed in; an app behind the nginx or Caddy
// sidecar was still sent it (AW-19). Everyone signs in once more.

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex('sessions').delete();
};

/**
 * @returns { Promise<void> }
 */
exports.down = async function () {};
