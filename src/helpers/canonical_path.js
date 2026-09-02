const path = require('path');

const NUL = String.fromCharCode(0);

// The path a request is authorized on must be the path the upstream will act
// on. Express hands us req.path exactly as the client sent it, and the proxy
// forwards it untouched, while nginx, Apache, Tomcat and most static servers
// resolve dot segments before routing. Matching "/lib/../admin" against a
// "/lib/*" public rule on the raw string therefore admits "/admin".
//
// Returns the decoded, normalized path when it is already in canonical form,
// and null when it is not — undecodable percent-encoding, a backslash, an
// encoded separator, a dot segment, or a duplicate slash. Callers treat null
// as "not public": the request still reaches the upstream for a signed-in
// user, but never without authentication.
function canonical_path(input)
{
    if (typeof input !== 'string' || input[0] !== '/') {
        return null;
    }

    let decoded;
    try {
        decoded = decodeURIComponent(input);
    }
    catch (error) {
        return null;
    }

    // NUL and backslash have no place in a URL path; a percent-encoded
    // separator that survived one decode (%252f) would become one at the
    // upstream's second decode.
    if (decoded.includes('\\') || decoded.includes(NUL) || /%(2f|5c)/i.test(decoded)) {
        return null;
    }

    // posix.normalize resolves "." and ".." and collapses "//". If that
    // changes anything, the path was not canonical.
    if (path.posix.normalize(decoded) !== decoded) {
        return null;
    }

    return decoded;
}

module.exports = canonical_path;
