async function csrf_middleware(req, res, next)
{
    if (req.body && req.body._csrf === req.session.csrf_token) {
        next();
    }
    else {
        next(new Error('[403] Invalid CSRF Token'));
    }
}

module.exports = csrf_middleware;
