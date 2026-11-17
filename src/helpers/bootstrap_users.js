const IdentityTaken = require('./errors/IdentityTaken');
const als = require('./als');
const assign_primary_email = require('./assign_primary_email');
const config = require('../../config');
const const_user_identity = require('./const/const_user_identity');
const db = require('../../db');
const normalize_email = require('./normalize/normalize_email');
const normalize_username = require('./normalize/normalize_username');
const random_uid_user_identity = require('./random/random_uid_user_identity');
const release_pending_email = require('./release_pending_email');
const users_create = require('./models/users_create');

async function bootstrap_users()
{
    if (!config.seed_users.length) {
        als.logger.write('👤 No seed_users defined, skipping');
        return;
    }

    als.logger.write('👤 Seeding users...');
    for (const user_seed of config.seed_users) {
        const {username, email, password, password_hash, display_name} = user_seed;
        const emails = Array.isArray(email) ? email : [email].filter(Boolean);

        const identities = identities_from_seed(username, emails);
        if (!identities.length) {
            const redacted = {...user_seed, password: password ? '[Filtered]' : undefined, password_hash: password_hash ? '[Filtered]' : undefined};
            als.logger.write(`⚠️ Skipping invalid user seed: [${JSON.stringify(redacted).slice(1, -1)}]`);
            continue;
        }

        const {user_id, user_created} = await seed_user_find_or_create({password, password_hash, display_name}, identities);
        if (user_created) {
            als.logger.write(`👤 Created user username=[${username}] email=[${email}]`);
            continue;
        }

        const added = await user_identities_add(user_id, identities);
        if (added > 0) {
            als.logger.write(`➕ Added identities username=[${username}] email=[${email}]`);
        }
        else {
            als.logger.write(`⏭️ No changes username=[${username}] email=[${email}]`);
        }
    }

    als.logger.write('✅ Users seeding complete');
}

// The user a seed names: the one holding its username or one of its addresses
// confirmed, or a new one holding all of them. An address another account
// holds unconfirmed is taken from that account first. Two copies starting at
// once on one database both find none and both create; the copy whose
// identities the other took first rolls its user back and takes the other's,
// as if it had started a moment later.
async function seed_user_find_or_create(params, identities)
{
    const ident = await seed_identity_find(identities);
    await seed_emails_release(identities, ident?.user_id ?? null);
    if (ident) {
        return {user_id: ident.user_id, user_created: false};
    }

    const user_id = await seed_user_create(params, identities);
    if (user_id) {
        return {user_id, user_created: true};
    }

    const taken = await seed_identity_find(identities);
    if (!taken) {
        throw new Error('A seed user lost its identities to another user, who is gone or holds them unconfirmed');
    }
    return {user_id: taken.user_id, user_created: false};
}

// An unconfirmed address proves nothing: anyone can sign up with anyone's
// address. It never selects the account that holds it.
async function seed_identity_find(identities)
{
    const query = db('user_identities');
    for (const identity of identities) {
        query.orWhere(function () {
            this.where({type: identity.type, value_normalized: identity.value_normalized});
            if (identity.type === const_user_identity.email) {
                this.whereNotNull('verified_at');
            }
        });
    }
    return query.first();
}

// The seed is the operator's word: an address of it that another account
// holds unconfirmed is released from that account at once, its open links
// with it. The user's own unconfirmed address stays as it is.
async function seed_emails_release(identities, user_id)
{
    for (const identity of identities) {
        if (identity.type === const_user_identity.email) {
            // No request at startup: the auth event has no session, IP or agent.
            await release_pending_email({}, identity.value_normalized, {user_id, seed: true});
        }
    }
}

// One unit: the user with every identity of its seed, or nothing at all.
// An identity another user took first rolls the user back: null.
async function seed_user_create(params, identities)
{
    try {
        return await db.transaction(async function () {
            const user = await users_create(params, {seed: true});
            await user_identities_insert(user.id, identities);
            const total = await user_identities_count(user.id);
            if (total < identities.length) {
                throw new IdentityTaken();
            }
            await assign_primary_email(user.id);
            return user.id;
        });
    }
    catch (error) {
        if (error instanceof IdentityTaken) {
            return null;
        }
        throw error;
    }
}

// The identities a seed names, each once: an address given twice, in
// another letter case, is one identity.
function identities_from_seed(username, emails)
{
    const out = [];
    const keys = new Set();
    const candidates = [
        {type: const_user_identity.username, value: username, value_normalized: normalize_username(username)},
        ...emails.map(v => ({type: const_user_identity.email, value: v, value_normalized: normalize_email(v)})),
    ];
    for (const candidate of candidates) {
        const key = `${candidate.type}:${candidate.value_normalized}`;
        if (candidate.value_normalized && !keys.has(key)) {
            keys.add(key);
            out.push(candidate);
        }
    }
    return out;
}

// The identities the user does not hold yet are added to it; the number
// added is returned. One held by another user stays with that user.
async function user_identities_add(user_id, identities)
{
    const total1 = await user_identities_count(user_id);
    await user_identities_insert(user_id, identities);
    await assign_primary_email(user_id);
    const total2 = await user_identities_count(user_id);
    return total2 - total1;
}

async function user_identities_insert(user_id, identities)
{
    const now = new Date();
    const rows = identities.map(v => ({uid: random_uid_user_identity(), user_id, type: v.type, value: v.value, value_normalized: v.value_normalized, created_at: now, updated_at: now, verified_at: now}));
    await db('user_identities').insert(rows).onConflict(['type', 'value_normalized']).ignore();
}

async function user_identities_count(user_id)
{
    const [{total}] = await db('user_identities').where({user_id}).count('* as total');
    return Number(total);
}

module.exports = bootstrap_users;
