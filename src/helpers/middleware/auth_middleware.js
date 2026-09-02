const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const email_verification_required = require('../email_verification_required');

// What a user held at email verification may still do: verify, fix a
// mistyped address (remove it, add the right one), or leave.
const EMAIL_VERIFICATION_ALLOWED_PATHS = new Set([
    '/auth/email-verify/request',
    '/auth/email-verify/confirm',
    '/auth/email/add',
    '/auth/email/remove',
    '/auth/sign-out',
]);

async function auth_middleware(req, res, next)
{
    // Intentionally checks req.session.user_id only — req.auth (bearer/PAT) is
    // not accepted. The /auth/* management endpoints (creating/revoking PATs,
    // revoking sessions, changing email/password, deleting the account) are
    // browser-only flows: they require an active session + CSRF token. A PAT
    // can authenticate proxied upstream requests, but cannot escalate by
    // managing its owner's authwall account.
    if (!req.session.user_id) {
        next(new UserFriendlyError('Authentication required'));
        return;
    }

    if (!EMAIL_VERIFICATION_ALLOWED_PATHS.has(req.path) && await email_verification_required(req)) {
        next(new UserFriendlyError('Email verification required'));
        return;
    }

    next();
}

module.exports = auth_middleware;
