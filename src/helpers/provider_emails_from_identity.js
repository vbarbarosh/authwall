// The addresses a provider identity's provider vouched for at its last
// sign-in (user_identities.provider_emails, AW-120), normalized; none when it
// kept none: a row from before they were kept, or one that is not a list.
function provider_emails_from_identity(ident)
{
    let parsed;
    try {
        parsed = JSON.parse(ident.provider_emails ?? '[]');
    }
    catch {
        return [];
    }
    if (!Array.isArray(parsed)) {
        return [];
    }
    return parsed.filter(v => typeof v === 'string');
}

module.exports = provider_emails_from_identity;
