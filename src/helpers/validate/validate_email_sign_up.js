const config = require('../../../config');

async function validate_email_sign_up(email_normalized)
{
    const [_, domain] = email_normalized.split('@');

    // denylist (always enforced)
    if (config.registration.denied_domains.includes(domain)) {
        throw new Error('Email domain is not allowed');
    }

    // allowlist
    if (config.registration.allowed_domains.length && !config.registration.allowed_domains.includes(domain)) {
        throw new Error('Email domain is not allowed');
    }
}

module.exports = validate_email_sign_up;
