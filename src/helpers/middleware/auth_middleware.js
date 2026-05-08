const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const email_verification_required = require('../email_verification_required');

const EMAIL_VERIFICATION_ALLOWED_PATHS = new Set([
    '/auth/email-verify/request',
    '/auth/sign-out',
]);

async function auth_middleware(req, res, next)
{
    if (!req.session.user_id) {
        next(new UserFriendlyError('Authentication required'));
        return;
    }

    if (email_verification_required(req) && !EMAIL_VERIFICATION_ALLOWED_PATHS.has(req.path)) {
        next(new UserFriendlyError('Email verification required'));
        return;
    }

    next();
}

module.exports = auth_middleware;
