const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');

async function auth_middleware(req, res, next)
{
    if (req.session.user_id) {
        next();
    }
    else {
        next(new UserFriendlyError('Authentication required'));
    }
}

module.exports = auth_middleware;
