const is_origin_form = require('./is_origin_form');

// The path of a request target exactly as the upstream acts on it. Only the
// scheme and host of an absolute URL are dropped; req.path and new URL() drop
// a fragment, turn "\" into "/" and resolve "..". Null for a non-path target.
function target_path(target)
{
    const path = (typeof target === 'string') ? target.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '') : null;
    if (!is_origin_form(path)) {
        return null;
    }
    return path.split('?')[0];
}

module.exports = target_path;
