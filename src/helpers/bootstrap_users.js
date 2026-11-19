const IdentityTaken = require('./errors/IdentityTaken');
const als = require('./als');
const assign_primary_email = require('./assign_primary_email');
const config = require('../../config');
const const_user_identity = require('./const/const_user_identity');
const db = require('../../db');
const log_value_from_string = require('./log_value_from_string');
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
    for (const [i, user_seed] of config.seed_users.entries()) {
        const {username, email, password, password_hash, display_name} = user_seed;
        const emails = Array.isArray(email) ? email : [email].filter(Boolean);

        const identities = identities_from_seed(username, emails);
        if (!identities.length) {
            const redacted = {...user_seed, password: password ? '[Filtered]' : undefined, password_hash: password_hash ? '[Filtered]' : undefined};
            als.logger.write(`⚠️ Skipping invalid user seed: [${JSON.stringify(redacted).slice(1, -1)}]`);
            continue;
        }

        const {user_id, user_created, left_alone, identities_held} = await seed_user_find_or_create({password, password_hash, display_name}, identities);
        if (identities_held) {
            // The place of the entry, as the seed file's own errors give it:
            // the operator fixes the seed, not the accounts.
            const user_uid_by_identity = Object.fromEntries(identities_held.map(v => [`${v.type}:${v.value_normalized}`, v.user_uid]));
            als.logger.write(`[seed_user_owners_differ] ⚠️ seed_user=${i + 1} username=${log_value_from_string(normalize_username(username) ?? '')} user_uid_by_identity=${JSON.stringify(user_uid_by_identity)} its identities are held by more than one account; nothing changed: one entry names one account`);
            continue;
        }
        if (left_alone) {
            als.logger.write(`[seed_user_left_alone] ⚠️ username=${log_value_from_string(normalize_username(username))} holds none of the seed's addresses confirmed; a stranger's: rename or remove it; yours: add the address from its profile`);
            continue;
        }
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

// The user a seed names, an existing one or a new one holding all its
// identities; or one it leaves alone; or none, its identities held by two
// accounts. An address another account holds unconfirmed is taken from that
// account first. Two copies starting at once on one database both find none
// and both create; the copy whose identities the other took first rolls its
// user back and takes the other's, as if it had started a moment later.
// Whoever took them is judged as at the start.
async function seed_user_find_or_create(params, identities)
{
    const found = await seed_user_find(identities);
    if (found) {
        return found;
    }

    await seed_emails_release(identities, null);
    const user_id = await seed_user_create(params, identities);
    if (user_id) {
        return {user_id, user_created: true, left_alone: false};
    }

    const taken = await seed_user_find(identities);
    if (!taken) {
        throw new Error('A seed user lost its identities to another user, who is gone or holds them unconfirmed');
    }
    return taken;
}

// The existing user a seed names: the one holding one of its addresses
// confirmed. A username proves nothing either: with sign-up open, anyone can
// take it before the seed runs. The account holding it is the seed's only for
// a seed with no address, which has nothing to give it; for any other it is
// left alone, as it is, whoever it belongs to. A seed whose identities two
// accounts hold names neither: it is refused before anything changes, and
// identities_held says whose they are.
async function seed_user_find(identities)
{
    const identities_held = await seed_identities_held_find(identities);
    if (!identities_held.length) {
        return null;
    }
    if (new Set(identities_held.map(v => v.user_id)).size > 1) {
        return {user_id: null, user_created: false, left_alone: false, identities_held};
    }

    const user_id = identities_held[0].user_id;
    const is_held_by_username = identities_held.every(v => v.type === const_user_identity.username);
    if (is_held_by_username && identities.some(v => v.type === const_user_identity.email)) {
        return {user_id, user_created: false, left_alone: true};
    }
    await seed_emails_release(identities, user_id);
    return {user_id, user_created: false, left_alone: false};
}

// The seed's identities that name an account: its username, and its
// addresses held confirmed. An unconfirmed address proves nothing: anyone can
// sign up with anyone's address. It never selects the account that holds it.
async function seed_identities_held_find(identities)
{
    const usernames_normalized = identities.filter(v => v.type === const_user_identity.username).map(v => v.value_normalized);
    const emails_normalized = identities.filter(v => v.type === const_user_identity.email).map(v => v.value_normalized);
    return db('user_identities')
        .join('users', 'users.id', 'user_identities.user_id')
        .where(function () {
            this.where('user_identities.type', const_user_identity.username).whereIn('user_identities.value_normalized', usernames_normalized);
        })
        .orWhere(function () {
            this.where('user_identities.type', const_user_identity.email).whereIn('user_identities.value_normalized', emails_normalized).whereNotNull('user_identities.verified_at');
        })
        .orderBy(['user_identities.type', 'user_identities.value_normalized'])
        .select('user_identities.type', 'user_identities.value_normalized', 'user_identities.user_id', 'users.uid AS user_uid');
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
