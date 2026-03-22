const bcrypt = require('bcrypt');
const config = require('../../../config');
const db = require('../../../db');
const random_slug = require('../random/random_slug');
const random_uid_user = require('../random/random_uid_user');

async function users_create(params = {})
{
    const trx = params.trx ?? db;
    const uid = params.uid ?? random_uid_user();
    const slug = params.slug ?? random_slug();
    const password_hash = params.password_hash
        ? params.password_hash
        : params.password
            ? await bcrypt.hash(params.password, config.password_rounds)
            : null;
    const display_name = params.display_name ?? null;
    const avatar_url = params.avatar_url ?? null;

    const now = new Date();
    await trx('users').insert({
        uid,
        slug,
        password_hash,
        display_name,
        avatar_url,
        created_at: now,
        updated_at: now,
    });

    return trx('users').where('uid', uid).first();
}

module.exports = users_create;
