const config = require('../../config');
const const_auth_event = require('./const/const_auth_event');
const const_auth_event_status = require('./const/const_auth_event_status');
const const_user_identity = require('./const/const_user_identity');
const db = require('../../db');

const SECOND = 1000;

// Whether a sign-up mailed the address its code within the resend cooldown.
// Read from the sign-up events, which removing the account does not take
// back (AW-124). Another account's added address does not count: its owner,
// sent to sign up by the link's "Not my account", does not wait.
async function is_sign_up_mail_recent(email_normalized, now = new Date())
{
    const recent = await db('auth_events')
        .where({event_type: const_auth_event.sign_up, event_status: const_auth_event_status.success, identity_type: const_user_identity.email, identity_value_normalized: email_normalized})
        .where('created_at', '>', new Date(now.getTime() - config.confirm_email.resend_cooldown_seconds*SECOND))
        .first('id');
    return Boolean(recent);
}

module.exports = is_sign_up_mail_recent;
