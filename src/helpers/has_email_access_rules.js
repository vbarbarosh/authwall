const config = require('../../config');

function has_email_access_rules()
{
    return config.access.allowed_emails.length > 0
        || config.access.allowed_domains.length > 0
        || config.access.denied_emails.length > 0
        || config.access.denied_domains.length > 0;
}

module.exports = has_email_access_rules;
