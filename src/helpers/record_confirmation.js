const confirmation_key = require('./confirmation_key');

// The owner just confirmed it is them, one way: a password, a code or a
// provider. The session keeps it for what asked, and which ways were given
// for that ask, one of each; an action may want two (account removal).
function record_confirmation(req, kind)
{
    const asked = req.session.confirmation ?? null;
    const same_ask = (confirmation_key(req.session.confirmed_for) === confirmation_key(asked));
    const given = same_ask ? (req.session.confirmed_with ?? []) : [];
    req.session.confirmed_at = new Date().toJSON();
    req.session.confirmed_for = asked;
    req.session.confirmed_with = [...new Set([...given, kind])];
    return given.length + (given.includes(kind) ? 0 : 1) >= (asked?.factors ?? 1);
}

module.exports = record_confirmation;
