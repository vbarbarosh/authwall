const config = require('../../config');

function email_verification_required(req)
{
    return config.email_verification.required && !req.session.email_verified_at;
}

module.exports = email_verification_required;
