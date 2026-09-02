const DOTLESS_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

// One local part, one "@", one domain, nothing that could be read as a second
// recipient, a header, or markup. Stricter than RFC 5322 on purpose: the value
// is stored, rendered, and handed to three mail providers with different
// parsers, and none of those should ever see a comma, a bracket, or a quote.
const SHAPE = /^[^\s@,;:<>"'()[\]\\\/]{1,64}@[^\s@,;:<>"'()[\]\\\/]{1,255}$/;

function normalize_email(email)
{
    const s = String(email||'').trim().toLowerCase();
    if (!s || s.length > 254 || !SHAPE.test(s) || has_control_chars(s)) {
        return null;
    }
    const at = s.lastIndexOf('@');
    const local = s.slice(0, at);
    const domain = s.slice(at + 1);
    if (DOTLESS_DOMAINS.has(domain)) {
        return local.replace(/\./g, '') + '@' + domain;
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

module.exports = normalize_email;
