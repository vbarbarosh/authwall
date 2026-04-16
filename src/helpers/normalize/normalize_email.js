const DOTLESS_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

function normalize_email(email)
{
    const s = String(email||'').trim().toLowerCase();
    if (!s) {
        return null;
    }
    const at = s.lastIndexOf('@');
    if (at === -1) {
        return s;
    }
    const local = s.slice(0, at);
    const domain = s.slice(at + 1);
    if (DOTLESS_DOMAINS.has(domain)) {
        return local.replace(/\./g, '') + '@' + domain;
    }
    return s;
}

module.exports = normalize_email;
