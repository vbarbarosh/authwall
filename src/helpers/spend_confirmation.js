const confirmation_key = require('./confirmation_key');
const is_recently_confirmed = require('./is_recently_confirmed');

// Whether the owner confirmed it is them for this very action, as many ways
// as it asks, and if so, spends the confirmation: it covers the action that
// asked for it, once, and never a second action inside its ten minutes
// (AW-81). routes/confirm.js records it (record_confirmation).
function spend_confirmation(req, asked)
{
    const given = req.session.confirmed_with ?? [];
    if (!is_recently_confirmed(req) || (confirmation_key(req.session.confirmed_for) !== confirmation_key(asked)) || (given.length < (asked.factors ?? 1))) {
        return false;
    }
    delete req.session.confirmed_at;
    delete req.session.confirmed_for;
    delete req.session.confirmed_with;
    delete req.session.confirmation;
    return true;
}

module.exports = spend_confirmation;
