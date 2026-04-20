const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_email = require('../helpers/const/const_email');
const db = require('../../db');
const format_date_pretty_24 = require('../helpers/format/format_date_pretty_24');
const insert_auth_event = require('../helpers/insert_auth_event');
const redirect = require('../helpers/redirect');
const replace_session = require('../helpers/replace_session');
const send_email_nothrow = require('../helpers/send_email_nothrow');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_password_change(req, res, user_id, auth_event_custom)
{
    const user = await db('users').where({id: user_id}).first();
    const replaced_session_uid = req.session.uid;

    await replace_session(req, user);

    await insert_auth_event({
        req,
        user,
        event_type: const_auth_event.password_changed,
        custom: {...auth_event_custom, replaced_session_uid},
    });

    // revoke other sessions
    await db('sessions').where({user_id}).whereNot({uid: req.sessionID}).del();

    // invalidate any pending password reset tokens
    await db('password_reset_tokens').where({user_id}).whereNull('used_at').del();

    redirect(req, res, config.pages.profile);

    await send_email_nothrow({
        name: const_email.password_changed_from_profile,
        user,
        placeholders: {
            display_name: user.display_name,
            date: format_date_pretty_24(),
            ip: req.session.ip ?? 'n/a',
            ua: req.session.ua ?? 'n/a',
            reset_link: config.public_url + urlmod(config.pages.password_reset_request),
        },
    });
}

module.exports = complete_password_change;
