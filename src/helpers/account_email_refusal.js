const access_refusal_from_identities = require('./access_refusal_from_identities');
const db = require('../../db');
const has_email_access_rules = require('./has_email_access_rules');

// Why the email access rules refuse an account, or null when they admit it:
// access_refusal_from_identities over everything the account holds, so a
// sign-in by any method and a credential already held get one answer
// (AW-28, AW-106).
async function account_email_refusal(user)
{
    if (!has_email_access_rules()) {
        return null;
    }

    const identities = await db('user_identities').where({user_id: user.id}).select('type', 'value_normalized', 'verified_at');
    return access_refusal_from_identities(identities);
}

module.exports = account_email_refusal;
