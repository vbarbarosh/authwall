const db = require('../../db');

// Gives back a try reserve_confirmation_try took: the answer was right, or it
// was never compared.
async function release_confirmation_try(uid)
{
    await db('auth_events').where({uid}).delete();
}

module.exports = release_confirmation_try;
