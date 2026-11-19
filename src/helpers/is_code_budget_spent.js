const const_auth_event_status = require('./const/const_auth_event_status');
const const_user_identity = require('./const/const_user_identity');
const db = require('../../db');

const WRONG_CODES_MAX = 10;
const WINDOW_MS = 60*60*1000;

// Guesses at an address's codes are counted across codes, so a new code
// every minute does not bring five new guesses (AW-02). They are counted from
// the wrong-code events of the address (`event_type`, the flow's), which
// neither a used code nor a deleted one, a removed address or a removed
// account, takes back (AW-124); the database counts them, across processes.
async function is_code_budget_spent(event_type, email_normalized, now = new Date())
{
    const [{wrong}] = await db('auth_events')
        .where({event_type, event_status: const_auth_event_status.failure, identity_type: const_user_identity.email, identity_value_normalized: email_normalized})
        .where('custom', 'like', '%"reason":"wrong_code"%')
        .where('created_at', '>', new Date(now.getTime() - WINDOW_MS))
        .count('* AS wrong');
    return Number(wrong) >= WRONG_CODES_MAX;
}

module.exports = is_code_budget_spent;
