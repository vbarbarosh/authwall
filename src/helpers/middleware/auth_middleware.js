async function auth_middleware(req, res, next)
{
    if (req.session.user_id) {
        next();
    }
    else {
        next(new Error('Authentication required'));
    }
}

module.exports = auth_middleware;
