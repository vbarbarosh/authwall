const canonical_path = require('./canonical_path');
const config = require('../../config');
const path_matches = require('./path_matches');

// An optional-auth path is reachable without sign-in, but a signed-in user is
// still proxied with X-Auth-User. Decided on the canonical form (see
// is_public_path).
function is_optional_auth_path(path)
{
    const canonical = canonical_path(path);
    return canonical !== null && path_matches(config.optional_auth_paths, canonical);
}

module.exports = is_optional_auth_path;
