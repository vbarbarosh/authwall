const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const crypto_equal = require('../crypto_equal');

async function csrf_middleware(req, res, next)
{
    if (crypto_equal(req.body?._csrf, req.session.csrf_token)) {
        next();
    }
    else {
        next(new UserFriendlyError('Invalid CSRF Token'));
    }
}

module.exports = csrf_middleware;
