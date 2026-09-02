const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const urlparts = require('@vbarbarosh/node-helpers/src/urlparts');

const REDACTED = '[Filtered]';

// Authwall's one-time credentials travel as query parameters: magic-link,
// email-verify and email-change tokens, password-reset tokens, and OAuth
// authorization codes. Any URL that reaches a log file, an error reporter, or
// any other lower-trust store has to go through here first — a token in a log
// is a working sign-in credential for whoever can read it.
//
// Values are replaced rather than removed: `token=[Filtered]` still shows that
// a token was sent, which is the question you are usually asking when reading
// these logs. The key set is matched, not enumerated — providers return
// access_token / refresh_token / id_token, and a fixed list silently misses
// whatever it was not written to expect.
function urlxxx(url)
{
    if (typeof url !== 'string' || !url) {
        return url;
    }

    const keys = Array.from(new URLSearchParams(urlparts(url).search).keys()).filter(is_sensitive_query_param);
    if (!keys.length) {
        // Return the input untouched rather than a re-serialized URL, so
        // normalization does not rewrite every logged line.
        return url;
    }

    return urlmod(url, Object.fromEntries(keys.map(key => [key, REDACTED])));
}

function is_sensitive_query_param(key)
{
    const normalized = key.toLowerCase();
    if (normalized.includes('token') || normalized.includes('secret') || normalized.includes('password')) {
        return true;
    }
    return ['code', 'state'].includes(normalized);
}

module.exports = urlxxx;
