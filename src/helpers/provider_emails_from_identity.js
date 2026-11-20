// The addresses a provider identity's provider gave at its last sign-in
// (AW-120), normalized: the ones it confirmed, user_identities.provider_emails,
// then the ones it gave unconfirmed, provider_unconfirmed_emails (Facebook's,
// AW-170); none when it kept none: a row from before they were kept, or one
// that is not a list.
function provider_emails_from_identity(ident)
{
    return [...emails_from_json(ident.provider_emails), ...emails_from_json(ident.provider_unconfirmed_emails)];
}

function emails_from_json(value)
{
    let parsed;
    try {
        parsed = JSON.parse(value ?? '[]');
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
