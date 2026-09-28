const db = require('../../db');

// A borrowed session can leave links in flight: a reset, an email change to
// the borrower's address, a verification of one. Recovery must kill them all.
// Change and verify rows are marked used, not deleted: they carry the resend cooldown.
async function revoke_pending_tokens(user_id)
{
    const now = new Date();
    await db('password_reset_tokens').where({user_id}).whereNull('used_at').del();
    await db('email_change_tokens').where({user_id}).whereNull('used_at').update({used_at: now, updated_at: now});
    await db('email_verify_tokens').where({user_id}).whereNull('used_at').update({used_at: now, updated_at: now});
}

module.exports = revoke_pending_tokens;
