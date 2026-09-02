const const_user_identity = require('../const/const_user_identity');
const db = require('../../../db');

// Resolves the address a message to this user should go to. Verified
// addresses come first; with verified_only, an account whose only address is
// unverified gets null — security notifications must not reach an address
// nobody has proven control of, since anyone can register any address.
async function get_user_email_and_name(user_id, {verified_only = false} = {})
{
    const ident = await db('user_identities')
        .where({type: const_user_identity.email, user_id})
        .orderByRaw('verified_at IS NULL ASC')
        .orderBy('id')
        .first();
    if (!ident || (verified_only && !ident.verified_at)) {
        return null;
    }

    const user = await db('users').where({id: user_id}).first();
    return {name: user.display_name, email: ident.value};
}

module.exports = get_user_email_and_name;
