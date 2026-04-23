const config = require('../../config');
const is_relative_url = require('./is_relative_url');

function redirect(req, res, default_url = '/')
{
    res.redirect(extract_return_url(req) ?? default_url);
}

// Allow:
//   - Relative paths (/foo, /foo/bar) — same origin by definition
//   - Absolute URLs on the same host as config.public_url
//   - Absolute URLs on any subdomain of config.public_url's hostname
//     (needed when authwall protects multiple apps on *.domain.com)
//
// Reject:
//   - Protocol-relative URLs (//evil.com) — treated as absolute by browsers
//   - Absolute URLs on unrelated origins
function extract_return_url(req)
{
    if (typeof req.query.return !== 'string') {
        return null;
    }

    const value = req.query.return;
    if (is_relative_url(value)) {
        return value;
    }

    // Absolute URL: validate origin against public_url
    try {
        const base = new URL(config.public_url);
        const url = new URL(value);

        // Scheme must match
        if (url.protocol !== base.protocol) {
            return null;
        }

        // Same host (hostname + port)
        if (url.host === base.host) {
            return value;
        }

        // Subdomain of base hostname: *.base.hostname
        if (url.hostname.endsWith('.' + base.hostname)) {
            return value;
        }
    }
    catch {
        // Malformed URL
    }

    return null;
}

module.exports = redirect;
