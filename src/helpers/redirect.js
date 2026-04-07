function redirect(req, res, default_url = '/')
{
    res.redirect(extract_return_url(req) ?? default_url);
}

// ⚠️ Check url against valid redirect urls; config.redirect_domain could be introduced for that
function extract_return_url(req)
{
    if (typeof req.query.return !== 'string') {
        return null;
    }

    return req.query.return;

    // // accept relative urls only
    // if (!is_relative_url(req.query.return)) {
    //     return null;
    // }
    //
    // try {
    //     const base = new URL(config.public_url);
    //     const url = new URL(req.query.return, base);
    //     if (url.origin === base.origin) {
    //         switch (url.pathname) {
    //         case config.pages.sign_in:
    //         case config.pages.sign_out:
    //             break;
    //         default:
    //             return url.pathname + url.search + url.hash;
    //         }
    //     }
    // }
    // catch {
    // }
    //
    // return null;
}

module.exports = redirect;
