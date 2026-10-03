const const_user_identity = require('./const/const_user_identity');
const db = require('../../db');
const email_access_rules_refusal = require('./email_access_rules_refusal');
const has_email_access_rules = require('./has_email_access_rules');

// Why the email access rules refuse an account, or null when they admit it.
// Every verified address the account holds must pass, not only the one a
// sign-in presents, so a denied address cannot sign in through another
// (AW-28). Shaped as username_sign_in_refusal's answer.
async function account_email_refusal(user)
{
    if (!has_email_access_rules()) {
        return null;
    }

    const emails = await db('user_identities')
        .where({user_id: user.id, type: const_user_identity.email})
        .whereNotNull('verified_at');

    const refusal = await email_access_rules_refusal(emails.map(v => v.value_normalized));
    if (refusal) {
        return {reason: 'email_not_authorized', email: refusal.email_normalized, error: refusal.error.message};
    }

    return null;
}

module.exports = account_email_refusal;
