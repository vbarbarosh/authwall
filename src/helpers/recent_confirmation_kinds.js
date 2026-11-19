const CONFIRMED_WINDOW_MS = 10*60*1000;

// The ways the owner confirmed it is them in this session (routes/confirm.js),
// each still within ten minutes of its own time: a password given long ago
// does not count beside a code given now (AW-109). A way recorded with no
// time of its own has the session's confirmed_at.
function recent_confirmation_kinds(req, now = Date.now())
{
    const times = req.session?.confirmed_times ?? {};
    const out = [];
    for (const kind of req.session?.confirmed_with ?? []) {
        const at = times[kind] ?? req.session.confirmed_at;
        if (at && ((now - new Date(at).getTime()) < CONFIRMED_WINDOW_MS)) {
            out.push(kind);
        }
    }
    return out;
}

module.exports = recent_confirmation_kinds;
