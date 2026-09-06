const EmailNotAuthorized = require('./errors/EmailNotAuthorized');
const authorize_email = require('./authorize_email');

// Checks verified addresses against the email access rules and reports the
// first refusal instead of throwing it, so the caller decides what the user
// gets told. Returns null when every address passes, otherwise the address and
// the EmailNotAuthorized it drew. Every address is checked, not just the first,
// so switching identifiers cannot evade a deny rule.
async function email_access_rules_refusal(emails_normalized)
{
    for (const email_normalized of emails_normalized) {
        try {
            await authorize_email(email_normalized);
        }
        catch (error) {
            if (!(error instanceof EmailNotAuthorized)) {
                throw error;
            }
            return {email_normalized, error};
        }
    }
    return null;
}

module.exports = email_access_rules_refusal;
