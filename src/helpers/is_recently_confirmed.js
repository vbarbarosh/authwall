const CONFIRMED_WINDOW_MS = 10*60*1000;

// Whether the owner confirmed it is them in this session (routes/confirm.js)
// recently enough to carry out an action that needs the owner.
function is_recently_confirmed(req)
{
    const confirmed_at = req.session?.confirmed_at;
    if (!confirmed_at) {
        return false;
    }
    return (Date.now() - new Date(confirmed_at).getTime()) < CONFIRMED_WINDOW_MS;
}

module.exports = is_recently_confirmed;
