const const_user_identity = require('./const/const_user_identity');
const db = require('../../db');

// A provider or another confirmed address: a way into the account besides this
// address and the password.
async function has_other_way_in({user_id, email_normalized})
{
    const ident = await db('user_identities')
        .where({user_id})
        .whereNot({type: const_user_identity.username})
        .whereNot({type: const_user_identity.email, value_normalized: email_normalized})
        .whereNotNull('verified_at')
        .first();
    return Boolean(ident);
}

module.exports = has_other_way_in;
