const is_recently_confirmed = require('./is_recently_confirmed');

// Whether the owner confirmed it is them for this very action, and if so,
// spends the confirmation: it covers the action that asked for it, once, and
// never a second action inside its ten minutes (AW-81). routes/confirm.js
// stores what was asked as `confirmed_for`.
function spend_confirmation(req, asked)
{
    if (!is_recently_confirmed(req) || (confirmation_key(req.session.confirmed_for) !== confirmation_key(asked))) {
        return false;
    }
    delete req.session.confirmed_at;
    delete req.session.confirmed_for;
    delete req.session.confirmation;
    return true;
}

function confirmation_key(asked)
{
    if (!asked) {
        return null;
    }
    return JSON.stringify([asked.reason ?? null, asked.provider ?? null, asked.disconnect ?? null]);
}

module.exports = spend_confirmation;
