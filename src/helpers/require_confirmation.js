const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const is_recently_confirmed = require('./is_recently_confirmed');
const save_session = require('./save_session');

// An action that needs the owner, not just a signed-in session (AW-04, AW-77).
// Without a recent "confirm it is you" (routes/confirm.js) the session keeps
// why and where to come back, and the request is refused; the SPA shows the
// confirmation, then returns to `next`, where the owner does it again.
async function require_confirmation(req, {reason, next, message, ...details})
{
    if (is_recently_confirmed(req)) {
        delete req.session.confirmation;
        return;
    }
    req.session.confirmation = {next, reason, ...details};
    await save_session(req);
    throw new UserFriendlyError(message);
}

module.exports = require_confirmation;
