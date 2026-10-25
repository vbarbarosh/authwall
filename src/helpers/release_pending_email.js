const config = require('../../config');
const const_auth_event = require('./const/const_auth_event');
const const_user_identity = require('./const/const_user_identity');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const has_other_way_in = require('./has_other_way_in');
const insert_auth_event = require('./insert_auth_event');

// Whether a pending address of another account let go of it for this claim.
// A pending address proves nothing, and holding it locked its owner out
// (AW-82, AW-06), so it yields: to a proof that the claimant reads the mailbox
// (a magic link, a provider's verified address, the mailed link's "Not my
// account"), when that account has another way in; and to any claim once
// nobody confirmed it within the confirmation window. An account with no
// other way in keeps it until then: its own mailed link hands it over (AW-25).
// A confirmed address never yields.
async function release_pending_email(req, email_normalized, {user_id = null, proof = false, now = new Date()} = {})
{
    const ident = await db('user_identities')
        .where({type: const_user_identity.email, value_normalized: email_normalized})
        .whereNull('verified_at')
        .first();
    if (!ident || (ident.user_id === user_id)) {
        return false;
    }

    const stale = await is_stale(ident, now);
    if (!stale && !(proof && await has_other_way_in({user_id: ident.user_id, email_normalized}))) {
        return false;
    }

    await db.transaction(async function () {
        await db('user_identities').where({id: ident.id}).whereNull('verified_at').delete();
        await db('email_verify_tokens').where({user_id: ident.user_id, email_normalized}).delete();
    });
    await insert_auth_event({
        req,
        user: {id: ident.user_id},
        ident,
        event_type: const_auth_event.identity_removed,
        custom: {reason: stale ? 'pending_email_stale' : 'pending_email_proven_elsewhere'},
    });
    return true;
}

// Older than the confirmation window, and no confirmation link still open.
async function is_stale(ident, now)
{
    if (date_add_minutes(new Date(ident.created_at), config.confirm_email.expires_minutes) > now) {
        return false;
    }
    const open = await db('email_verify_tokens')
        .where({user_id: ident.user_id, email_normalized: ident.value_normalized})
        .whereNull('used_at')
        .where('expires_at', '>', now)
        .first();
    return !open;
}

module.exports = release_pending_email;
