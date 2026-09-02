// A username is rendered in the SPA and in e-mail bodies and is compared
// case-sensitively after trimming. Markup characters, quotes, control
// characters and "@" (which sign-in reads as an e-mail address) are refused.
const FORBIDDEN = /[<>"'&@]/;
const MAX_LENGTH = 64;

function normalize_username(username)
{
    const s = String(username||'').trim();
    if (!s || s.length > MAX_LENGTH || FORBIDDEN.test(s) || has_control_chars(s)) {
        return null;
    }
    return s;
}

function has_control_chars(s)
{
    for (let i = 0; i < s.length; ++i) {
        const c = s.charCodeAt(i);
        if (c < 32 || c === 127) {
            return true;
        }
    }
    return false;
}

module.exports = normalize_username;
