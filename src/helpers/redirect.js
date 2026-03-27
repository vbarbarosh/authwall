function redirect(req, res, default_url = '/')
{
    if (typeof req.query.return === 'string' && req.query.return.startsWith('/')) {
        res.redirect(req.query.return);
    }
    else {
        res.redirect(default_url);
    }
}

module.exports = redirect;
