function normalize_username(username)
{
    return String(username||'').trim() || null;
}

module.exports = normalize_username;
