const const_user_identity = require('./const/const_user_identity');
const db = require('../../db');
const email_access_rules_refusal = require('./email_access_rules_refusal');
const has_email_access_rules = require('./has_email_access_rules');

// Why the email access rules refuse a username sign-in, or null when they
// admit it. A username cannot establish eligibility under an email policy, so
// the account's verified addresses stand in for it on the terms OAuth gets:
// at least one is required, and every one must pass.
//
// The answer is returned rather than thrown because it must never reach the
// user. It is asked only after the password validated, and a refusal that
// named the email policy would confirm the password to whoever guessed it.
// The caller answers as a wrong password does and records this in the auth
// event.
async function username_sign_in_refusal(user)
{
    if (!has_email_access_rules()) {
        return null;
    }

    const emails = await db('user_identities')
        .where({user_id: user.id, type: const_user_identity.email})
        .whereNotNull('verified_at');
    if (!emails.length) {
        return {reason: 'no_verified_email'};
    }

    const refusal = await email_access_rules_refusal(emails.map(v => v.value_normalized));
    if (refusal) {
        return {reason: 'email_not_authorized', email: refusal.email_normalized, error: refusal.error.message};
    }

    return null;
}

module.exports = username_sign_in_refusal;
