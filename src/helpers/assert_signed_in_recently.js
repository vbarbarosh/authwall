const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');

// The ten minutes a confirmation lasts (is_recently_confirmed).
const SIGNED_IN_WINDOW_MS = 10*60*1000;

// Throws unless this session signed in within the last ten minutes: so fresh
// a sign-in stands for "confirm it is you" where the confirmation cannot be
// asked, at the verify step (AW-119). A session is made at sign-in
// (replace_session), and SessionStore reads when into `created_at`.
function assert_signed_in_recently(req, message)
{
    const created_at = req.session?.created_at;
    if (!created_at || ((Date.now() - new Date(created_at).getTime()) >= SIGNED_IN_WINDOW_MS)) {
        throw new UserFriendlyError(message);
    }
}

module.exports = assert_signed_in_recently;
