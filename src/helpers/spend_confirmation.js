const claim_confirmation = require('./claim_confirmation');
const confirmation_key = require('./confirmation_key');
const is_recently_confirmed = require('./is_recently_confirmed');
const recent_confirmation_kinds = require('./recent_confirmation_kinds');

// Whether the owner confirmed it is them for this very action, as many ways
// as it asks, and if so, spends the confirmation: it covers the action that
// asked for it, once, and never a second action inside its ten minutes
// (AW-81), nor the same action twice at once (AW-107). routes/confirm.js
// records it (record_confirmation).
async function spend_confirmation(req, asked)
{
    const given = recent_confirmation_kinds(req);
    if (!is_recently_confirmed(req) || (confirmation_key(req.session.confirmed_for) !== confirmation_key(asked)) || (given.length < (asked.factors ?? 1))) {
        return false;
    }
    if (!await claim_confirmation(req)) {
        return false;
    }
    delete req.session.confirmed_at;
    delete req.session.confirmed_for;
    delete req.session.confirmed_with;
    delete req.session.confirmed_times;
    delete req.session.confirmation;
    return true;
}

module.exports = spend_confirmation;
