// What a confirmation was asked for, as one comparable value: the action and,
// for a provider, which one and which account at it, so a confirmed connect
// links the account the owner was shown and no other (AW-108)
// (routes/confirm.js, spend_confirmation).
function confirmation_key(asked)
{
    if (!asked) {
        return null;
    }
    return JSON.stringify([asked.reason ?? null, asked.provider ?? null, asked.subject ?? null, asked.disconnect ?? null]);
}

module.exports = confirmation_key;
