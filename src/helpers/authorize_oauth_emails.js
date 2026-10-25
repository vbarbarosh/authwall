const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const email_access_rules_refusal = require('./email_access_rules_refusal');
const has_email_access_rules = require('./has_email_access_rules');
const normalize_email = require('./normalize/normalize_email');

async function authorize_oauth_emails(emails, {require_one_when_access_rules = false} = {})
{
    const out = emails
        .map(v => ({email: v, email_normalized: normalize_email(v)}))
        .filter(v => v.email_normalized);

    if (require_one_when_access_rules && has_email_access_rules() && !out.length) {
        throw new UserFriendlyError('A verified email is required');
    }

    const refusal = await email_access_rules_refusal(out.map(v => v.email_normalized));
    if (refusal) {
        throw refusal.error;
    }

    return out;
}

module.exports = authorize_oauth_emails;
