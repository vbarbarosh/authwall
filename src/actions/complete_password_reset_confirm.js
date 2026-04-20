const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_email = require('../helpers/const/const_email');
const db = require('../../db');
const destroy_session = require('../helpers/destroy_session');
const format_date_pretty_24 = require('../helpers/format/format_date_pretty_24');
const insert_auth_event = require('../helpers/insert_auth_event');
const redirect = require('../helpers/redirect');
const send_email_nothrow = require('../helpers/send_email_nothrow');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_password_reset_confirm(req, res, user_id, token_hash)
{
    const user = await db('users').where({id: user_id}).first();
    const ip = req.session.ip ?? 'n/a';
    const ua = req.session.ua ?? 'n/a';

    // revoke all sessions
    const replaced_session_uid = req.session.uid;

    await db('sessions').where({user_id}).delete();
    await destroy_session(req);

    await insert_auth_event({
        req,
        user,
        event_type: const_auth_event.password_reset_completed,
        custom: {replaced_session_uid, token_hash},
    });

    redirect(req, res, config.pages.sign_in);

    await send_email_nothrow({
        name: const_email.password_changed_via_reset_link,
        user,
        placeholders: {
            display_name: user.display_name,
            date: format_date_pretty_24(),
            ip,
            ua,
            reset_link: config.public_url + urlmod(config.pages.password_reset_request),
        },
    });
}

module.exports = complete_password_reset_confirm;
