// What a confirmation was asked for, as one comparable value: the action and,
// for a provider, which one (routes/confirm.js, spend_confirmation).
function confirmation_key(asked)
{
    if (!asked) {
        return null;
    }
    return JSON.stringify([asked.reason ?? null, asked.provider ?? null, asked.disconnect ?? null]);
}

module.exports = confirmation_key;
