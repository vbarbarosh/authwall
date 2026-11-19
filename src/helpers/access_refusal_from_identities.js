const config = require('../../config');
const const_user_identity = require('./const/const_user_identity');
const email_access_rules_refusal = require('./email_access_rules_refusal');
const has_email_access_rules = require('./has_email_access_rules');
const provider_emails_from_identity = require('./provider_emails_from_identity');

// The sign-in flow of each provider identity.
const PROVIDER_FLOWS = new Map([
    [const_user_identity.oauth_discord, 'discord'],
    [const_user_identity.oauth_facebook, 'facebook'],
    [const_user_identity.oauth_github, 'github'],
    [const_user_identity.oauth_google, 'google'],
    [const_user_identity.oauth_microsoft, 'microsoft'],
    [const_user_identity.oauth_twitter, 'twitter'],
]);

// Why the email access rules refuse an account with these identities (rows
// of user_identities: type, value_normalized, verified_at, provider_emails),
// or null when they admit it. The one answer for a sign-in and for every
// credential the account already holds: a session, a token, a socket
// (AW-106).
//
// Every verified address must pass (AW-28). And the account must have a way
// to meet the rules, as a sign-in would: a verified address; an account at an
// enabled provider whose addresses, the ones it vouched for at its last
// sign-in, pass (AW-120): a session or a token is no sign-in, and the stored
// addresses may go; or a pending address the rules admit, where confirmation
// is required and holds the account at it until it is confirmed. A username
// alone has none (notes/decisions.md).
async function access_refusal_from_identities(identities)
{
    if (!has_email_access_rules()) {
        return null;
    }

    const emails = identities.filter(v => v.type === const_user_identity.email);
    const verified = emails.filter(v => v.verified_at).map(v => v.value_normalized);
    const refusal = await email_access_rules_refusal(verified);
    if (refusal) {
        return {reason: 'email_not_authorized', email: refusal.email_normalized, error: refusal.error.message};
    }
    if (verified.length) {
        return null;
    }

    let provider_refusal = null;
    for (const ident of identities.filter(v => PROVIDER_FLOWS.has(v.type) && config.flows[PROVIDER_FLOWS.get(v.type)].enabled)) {
        const provider_emails = provider_emails_from_identity(ident);
        if (!provider_emails.length) {
            continue;
        }
        const refusal = await email_access_rules_refusal(provider_emails);
        if (!refusal) {
            return null;
        }
        provider_refusal ??= {reason: 'email_not_authorized', email: refusal.email_normalized, error: refusal.error.message};
    }

    if (config.confirm_email.required) {
        for (const email of emails) {
            if (!await email_access_rules_refusal([email.value_normalized])) {
                return null;
            }
        }
    }

    return provider_refusal ?? {reason: 'no_verified_email', error: 'A verified email is required'};
}

module.exports = access_refusal_from_identities;
