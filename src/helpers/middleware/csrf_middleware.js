const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');

async function csrf_middleware(req, res, next)
{
    if (req.body && req.body._csrf === req.session.csrf_token) {
        next();
    }
    else {
        next(new UserFriendlyError('Invalid CSRF Token'));
    }
}

module.exports = csrf_middleware;
