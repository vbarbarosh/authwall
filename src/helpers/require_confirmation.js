const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const save_session = require('./save_session');
const send_confirm_code = require('./send_confirm_code');
const spend_confirmation = require('./spend_confirmation');

// An action that needs the owner, not just a signed-in session (AW-04, AW-77).
// Without a confirmation made for it (routes/confirm.js) the session keeps
// why and where to come back, a code goes to the primary address, and the
// request is refused; the SPA shows the confirmation, then returns to `next`,
// where the owner does it again. The confirmation is spent by that action
// (AW-81). `factors`: how many different ways it takes, 1 unless given.
async function require_confirmation(req, {reason, next, message, ...details})
{
    const asked = {next, reason, ...details};
    if (spend_confirmation(req, asked)) {
        return;
    }
    req.session.confirmation = asked;
    await save_session(req);
    try {
        await send_confirm_code(req);
    }
    catch (error) {
        // No primary, no mailer, or a code already on its way: the
        // confirmation page offers what there is.
        if (!(error instanceof UserFriendlyError)) {
            throw error;
        }
    }
    throw new UserFriendlyError(message);
}

module.exports = require_confirmation;
