const config = require('../../config');
const session_email_verification = require('./models/session_email_verification');

// Whether this session must still confirm an email before it may proceed.
//
// The session carries an email_verified_at snapshot written only at sign-in.
// Reading only that snapshot locks out a user who verified in another session
// (they stay "unverified" here until they sign in again). So when the snapshot
// says unverified, consult the live database and heal the snapshot. A user who
// is held cannot reach the proxy, so this database read never runs on the
// proxied hot path — a verified session takes the fast branch above it.
async function email_verification_required(req)
{
    if (!config.confirm_email.required) {
        return false;
    }
    if (req.session?.email_verified_at) {
        return false;
    }

    const user_id = req.session?.user_id;
    if (!user_id) {
        return true;
    }

    const {email, email_verified_at} = await session_email_verification(user_id);
    if (email_verified_at) {
        req.session.email = email;
        req.session.email_verified_at = email_verified_at;
        return false;
    }

    return true;
}

module.exports = email_verification_required;
