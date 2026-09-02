// Matches a request path against a list of configured paths. An entry ending
// in /* is a prefix (e.g. /lib/* matches /lib/app.js); everything else is an
// exact match. Callers pass an already-canonical path (see canonical_path).
function path_matches(paths, path)
{
    return paths.some(function (configured_path) {
        if (configured_path.endsWith('/*')) {
            return path.startsWith(configured_path.slice(0, -1));
        }
        return path === configured_path;
    });
}

module.exports = path_matches;
