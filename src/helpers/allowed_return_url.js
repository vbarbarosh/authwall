const config = require('../../config');
const is_relative_url = require('./is_relative_url');

// Allow:
//   - Relative paths (/foo, /foo/bar) — same origin by definition
//   - Absolute URLs on the same host as config.public_url
//   - Absolute URLs on any subdomain of config.public_url's hostname
//     (needed when authwall protects multiple apps on *.domain.com)
//
// Reject:
//   - Protocol-relative URLs (//evil.com) — treated as absolute by browsers
//   - Absolute URLs on unrelated origins
//   - Control characters: a browser drops tabs and line breaks from a URL
//     before it reads one, so "/\t/evil.com" passed as a path here and was
//     followed as //evil.com by the SPA's landing (AW-113)
function allowed_return_url(value)
{
    if (typeof value !== 'string') {
        return null;
    }

    if (/[\u0000-\u001f\u007f]/.test(value)) {
        return null;
    }

    // Resolved once on the public origin, as the browser will resolve it, and
    // returned as given: serialized again, "/..//evil.com" would read as
    // //evil.com.
    if (is_relative_url(value)) {
        const base = new URL(config.public_url);
        return (new URL(value, base).origin === base.origin) ? value : null;
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

module.exports = allowed_return_url;
