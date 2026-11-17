const allowed_return_url = require('./allowed_return_url');

// The request's own `return` first; then the one a sign-in kept while it was
// away at a provider (res.locals.return_url, make_oauth_flow.js).
function redirect(req, res, default_url = '/')
{
    res.redirect(allowed_return_url(req.query.return) ?? allowed_return_url(res.locals.return_url) ?? default_url);
}

module.exports = redirect;
