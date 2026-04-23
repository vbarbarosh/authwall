const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const config = require('../../config');

async function authorize_email(email_normalized)
{
    const [_, domain] = email_normalized.split('@');
    const has_allowed_emails = config.access.allowed_emails.length > 0;
    const has_allowed_domains = config.access.allowed_domains.length > 0;

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

    if (has_allowed_domains && config.access.allowed_domains.includes(domain)) {
        return;
    }

    // allowlist default deny
    if (has_allowed_domains) {
        throw new UserFriendlyError('Email domain is not allowed');
    }

    if (has_allowed_emails) {
        throw new UserFriendlyError('Email is not allowed');
    }
}

module.exports = authorize_email;
