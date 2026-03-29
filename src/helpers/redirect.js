const config = require('../../config');
const is_relative_url = require('./is_relative_url');

function redirect(req, res, default_url = '/')
{
    res.redirect(extract_return_url(req) ?? default_url);
}

function extract_return_url(req)
{
    if (typeof req.query.return !== 'string') {
        return null;
    }

    // accept relative urls only
    if (!is_relative_url(req.query.return)) {
        return null;
    }

    try {
        const base = new URL(config.public_url);
        const url = new URL(req.query.return, base);
        if (url.origin === base.origin) {
            switch (url.pathname) {
            case config.pages.sign_in:
            case config.pages.sign_out:
                break;
            default:
                return url.pathname + url.search + url.hash;
            }
        }
    }
    catch {
    }

    return null;
}

module.exports = redirect;
