const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const config = require('../../config');

async function authorize_email(email_normalized)
{
    const [_, domain] = email_normalized.split('@');

    if (config.access.denied_emails.includes(email_normalized)) {
        throw new UserFriendlyError('Email is not allowed');
    }

    if (config.access.allowed_emails.includes(email_normalized)) {
        return;
    }

    // denylist (always enforced)
    if (config.access.denied_domains.includes(domain)) {
        throw new UserFriendlyError('Email domain is not allowed');
    }

    // allowlist
    if (config.access.allowed_domains.length && !config.access.allowed_domains.includes(domain)) {
        throw new UserFriendlyError('Email domain is not allowed');
    }
}

module.exports = authorize_email;
