const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const authorize_email = require('./authorize_email');
const config = require('../../config');
const normalize_email = require('./normalize/normalize_email');

function has_access_rules()
{
    return config.access.denied_emails.length > 0
        || config.access.allowed_emails.length > 0
        || config.access.denied_domains.length > 0
        || config.access.allowed_domains.length > 0;
}

async function authorize_oauth_verified_emails(emails, {require_one_when_access_rules = false} = {})
{
    const verified_emails = emails
        .map(email => ({email, email_normalized: normalize_email(email)}))
        .filter(v => v.email_normalized);

    if (require_one_when_access_rules && has_access_rules() && !verified_emails.length) {
        throw new UserFriendlyError('A verified email is required');
    }

    for (const {email_normalized} of verified_emails) {
        await authorize_email(email_normalized);
    }

    return verified_emails;
}

module.exports = authorize_oauth_verified_emails;
