const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const save_session = require('./save_session');
const spend_confirmation = require('./spend_confirmation');

// An action that needs the owner, not just a signed-in session (AW-04, AW-77).
// Without a confirmation made for it (routes/confirm.js) the session keeps
// why and where to come back, and the request is refused; the SPA shows the
// confirmation, then returns to `next`, where the owner does it again. The
// confirmation is spent by that action (AW-81).
async function require_confirmation(req, {reason, next, message, ...details})
{
    const asked = {next, reason, ...details};
    if (spend_confirmation(req, asked)) {
        return;
    }
    req.session.confirmation = asked;
    await save_session(req);
    throw new UserFriendlyError(message);
}

module.exports = require_confirmation;
