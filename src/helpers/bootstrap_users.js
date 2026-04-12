const als = require('./als');
const config = require('../../config');
const const_user_identity = require('./const/const_user_identity');
const db = require('../../db');
const normalize_email = require('./normalize/normalize_email');
const normalize_username = require('./normalize/normalize_username');
const random_uid_user_identity = require('./random/random_uid_user_identity');
const users_create = require('./models/users_create');

async function bootstrap_users()
{
    if (!config.seed_users.length) {
        als.logger.write('👤 No seed_users defined, skipping');
        return;
    }

    als.logger.write('👤 Seeding users...');
    for (const user_seed of config.seed_users) {
        const {username, email, password_hash, display_name} = user_seed;
        const emails = Array.isArray(email) ? email : [email].filter(Boolean);

        const username_normalized = normalize_username(username);
        const emails_normalized = emails.map(normalize_email).filter(v => v);
        if (!username_normalized && !emails_normalized.length) {
            als.logger.write(`⚠️ Skipping invalid user seed: [${JSON.stringify(user_seed).slice(1, -1)}]`);
            continue;
        }

        // Either find user or create one
        const ident = await db('user_identities')
            .where(function (q) {
                if (username_normalized) {
                    q.orWhere({type: const_user_identity.username, value_normalized: username_normalized});
                }
                if (emails_normalized.length) {
                    q.orWhere(function (qq) {
                        qq.where('type', const_user_identity.email);
                        qq.whereIn('value_normalized', emails_normalized);
                    });
                }
            })
            .first();

        let user_id;
        let user_created = !ident;
        if (ident) {
            user_id = ident.user_id;
        }
        else {
            const user = await users_create({password_hash, display_name});
            user_id = user.id;
        }

        const idents1 = await db('user_identities').where({user_id}).count();

        const now = new Date();
        const base = {user_id, created_at: now, updated_at: now, verified_at: now};
        const rows = [
            {...base, uid: random_uid_user_identity(), type: const_user_identity.username, value: username, value_normalized: username_normalized},
            ...emails.map(v => ({...base, user_id, uid: random_uid_user_identity(), type: const_user_identity.email, value: v, value_normalized: normalize_email(v)})),
        ].filter(v => v.value_normalized);
        await db('user_identities').insert(rows).onConflict(['type', 'value_normalized']).ignore();

        const idents2 = await db('user_identities').where({user_id}).count();

        if (user_created) {
            als.logger.write(`👤 Created user username=[${username}] email=[${email}]`);
        }
        else if (idents1 < idents2) {
            als.logger.write(`➕ Added identities username=[${username}] email=[${email}]`);
        }
        else {
            als.logger.write(`⏭️ No changes username=[${username}] email=[${email}]`);
        }
    }

    als.logger.write('✅ Users seeding complete');
}

module.exports = bootstrap_users;
