const config = require('../../config');
const db = require('../../db');
const fs_exists = require('@vbarbarosh/node-helpers/src/fs_exists');
const fs_read_lines = require('@vbarbarosh/node-helpers/src/fs_read_lines');
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

        if (email) {
            if (await db('users').where({email}).first()) {
                console.log(`🙈 Skipping existing user username=[${username}] email=[${email}]`);
                continue;
            }
        }
        if (username) {
            if (await db('users').where({username}).first()) {
                console.log(`🙈 Skipping existing user username=[${username}] email=[${email}]`);
                continue;
            }
        }

        const now = new Date();
        await db('users').insert({
            uid: random_uid_user(),
            slug: random_slug(),
            username,
            email,
            password_hash,
            display_name,
            created_at: now,
            updated_at: now,
        });
        console.log(`👤 Added user username=[${username}] email=[${email}]`);
    }

    console.log('✅ Users seeding complete');
}

module.exports = bootstrap_users;
