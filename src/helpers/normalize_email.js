function normalize_email(email)
{
    return String(email||'').trim().toLowerCase() || null;
}

module.exports = normalize_email;
