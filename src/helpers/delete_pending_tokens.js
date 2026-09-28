const db = require('../../db');

// A borrowed session can leave links in flight: a reset, an email change to
// the borrower's address, a verification of one. Recovery must kill them all.
async function delete_pending_tokens(user_id)
{
    await db('password_reset_tokens').where({user_id}).whereNull('used_at').del();
    await db('email_change_tokens').where({user_id}).whereNull('used_at').del();
    await db('email_verify_tokens').where({user_id}).whereNull('used_at').del();
}

module.exports = delete_pending_tokens;
