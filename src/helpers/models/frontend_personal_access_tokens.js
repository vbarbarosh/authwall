function frontend_personal_access_tokens(items)
{
    return items.map(function (pat) {
        return {
            uid: pat.uid,
            label: pat.label,
            token_prefix: pat.token_prefix,
            created_at: pat.created_at && new Date(pat.created_at).toJSON(),
            updated_at: pat.updated_at && new Date(pat.updated_at).toJSON(),
            expires_at: pat.expires_at && new Date(pat.expires_at).toJSON(),
            last_used_at: pat.last_used_at && new Date(pat.last_used_at).toJSON(),
            revoked_at: pat.revoked_at && new Date(pat.revoked_at).toJSON(),
            last_used_ip: pat.last_used_ip,
            last_used_ua: pat.last_used_ua,
        };
    });
}

module.exports = frontend_personal_access_tokens;
