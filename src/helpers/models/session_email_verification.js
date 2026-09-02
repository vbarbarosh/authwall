const const_user_identity = require('../const/const_user_identity');
const db = require('../../../db');

// The email + verification state cached on the session at sign-in. A verified
// address is preferred over an unverified one, so a user with both is treated
// as verified.
async function session_email_verification(user_id)
{
    const ident = await db('user_identities')
        .where({user_id, type: const_user_identity.email})
        .orderByRaw('verified_at IS NULL ASC')
        .orderBy('id')
        .first();

    return {
        email: ident?.value ?? null,
        email_verified_at: ident?.verified_at ? new Date(ident.verified_at).toJSON() : null,
    };
}

module.exports = session_email_verification;
