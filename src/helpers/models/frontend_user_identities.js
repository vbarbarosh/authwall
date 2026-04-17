function frontend_user_identities(user_identities)
{
    return user_identities.map(function (ident) {
        return {
            uid: ident.uid,
            type: ident.type,
            value: ident.value,
            value_normalized: ident.value_normalized,
            created_at: ident.created_at && new Date(ident.created_at).toJSON(),
            updated_at: ident.updated_at && new Date(ident.updated_at).toJSON(),
            verified_at: ident.verified_at && new Date(ident.verified_at).toJSON(),
        };
    });
}

module.exports = frontend_user_identities;
