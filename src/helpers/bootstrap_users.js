const config = require('../../config');
const const_user_identity = require('./const/const_user_identity');
const db = require('../../db');
const fs_exists = require('@vbarbarosh/node-helpers/src/fs_exists');
const fs_read_lines = require('@vbarbarosh/node-helpers/src/fs_read_lines');
const normalize_email = require('./normalize/normalize_email');
const normalize_username = require('./normalize/normalize_username');
const random_slug = require('./random/random_slug');
const random_uid_user = require('./random/random_uid_user');

async function bootstrap_users()
{
    if (!await fs_exists(config.users_file)) {
        console.log('👤 No users file, skipping');
        return;
    }

    console.log('👤 Seeding users from users.txt...');
    for (const line of await fs_read_lines(config.users_file)) {
        const expr = line.trim();
        if (!expr || expr[0] === '#') {
            continue;
        }
        const [username, email, password_hash, display_name] = expr.split('|').map(v => v.trim() || null);
        if (!email && !username) {
            console.log(`⚠️ Skipping invalid line: [${JSON.stringify(line).slice(1, -1)}]`);
            continue;
        }

        const email_normalized = normalize_email(email);
        if (email_normalized) {
            const ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first();
            if (ident) {
                console.log(`ℹ️ Skipping existing user username=[${username}] email=[${email}]`);
                continue;
            }
        }

        const username_normalized = normalize_username(username);
        if (username_normalized) {
            const ident = await db('user_identities').where({type: const_user_identity.username, value_normalized: username_normalized}).first();
            if (ident) {
                console.log(`ℹ️ Skipping existing user username=[${username}] email=[${email}]`);
                continue;
            }
        }

        const now = new Date();
        await db.transaction(async function (trx) {
            const [user_id] = await trx('users').insert({
                uid: random_uid_user(),
                slug: random_slug(),
                password_hash,
                display_name,
                created_at: now,
                updated_at: now,
            });
            if (email_normalized) {
                await trx('user_identities').insert({
                    user_id,
                    type: const_user_identity.email,
                    value: email,
                    value_normalized: email_normalized,
                    created_at: now,
                    updated_at: now,
                    verified_at: now,
                });
            }
            if (username_normalized) {
                await trx('user_identities').insert({
                    user_id,
                    type: const_user_identity.username,
                    value: username,
                    value_normalized: username_normalized,
                    created_at: now,
                    updated_at: now,
                    verified_at: now,
                });
            }
        });

        console.log(`👤 Added user username=[${username}] email=[${email}]`);
    }

    console.log('✅ Users seeding complete');
}

module.exports = bootstrap_users;
