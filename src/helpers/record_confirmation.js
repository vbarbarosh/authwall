const confirmation_key = require('./confirmation_key');
const recent_confirmation_kinds = require('./recent_confirmation_kinds');

// The owner just confirmed it is them, one way: a password, a code or a
// provider. The session keeps it for what asked, and which ways were given
// for that ask, one of each, each with its own time; an action may want two
// (account removal), and a way given too long ago no longer counts (AW-109).
function record_confirmation(req, kind)
{
    const asked = req.session.confirmation ?? null;
    const same_ask = (confirmation_key(req.session.confirmed_for) === confirmation_key(asked));
    const given = same_ask ? recent_confirmation_kinds(req) : [];
    const now = new Date().toJSON();
    const times = Object.fromEntries(given.map(v => [v, req.session.confirmed_times?.[v] ?? req.session.confirmed_at]));
    times[kind] = now;
    req.session.confirmed_at = now;
    req.session.confirmed_for = asked;
    req.session.confirmed_with = Object.keys(times);
    req.session.confirmed_times = times;
    return Object.keys(times).length >= (asked?.factors ?? 1);
}

module.exports = record_confirmation;
