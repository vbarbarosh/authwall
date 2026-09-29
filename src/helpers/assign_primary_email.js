const const_user_identity = require('./const/const_user_identity');
const db = require('../../db');

// Every account's primary address is its first verified one (AW-24). Called
// wherever an account gains or loses a verified address; a no-op once set.
async function assign_primary_email(user_id)
{
    const primary = await db('user_identities').where({user_id}).whereNotNull('primary_at').first();
    if (primary) {
        return;
    }
    const oldest = await db('user_identities').where({user_id, type: const_user_identity.email}).whereNotNull('verified_at').orderBy('id').first();
    if (!oldest) {
        return;
    }
    const now = new Date();
    await db('user_identities').where({id: oldest.id}).update({primary_at: now, updated_at: now});
}

module.exports = assign_primary_email;
