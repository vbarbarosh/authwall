const canonical_path = require('./canonical_path');
const config = require('../../config');
const path_matches = require('./path_matches');

// A public path bypasses sign-in and is proxied without an X-Auth-User header.
// Decided on the canonical form, never the raw target: a path that cannot be
// canonicalized (dot segments, encoded separators) is never public.
function is_public_path(path)
{
    const canonical = canonical_path(path);
    return canonical !== null && path_matches(config.public_paths, canonical);
}

module.exports = is_public_path;
