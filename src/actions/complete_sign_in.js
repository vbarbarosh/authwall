const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_email = require('../helpers/const/const_email');
const format_date_pretty_24 = require('../helpers/format/format_date_pretty_24');
const get_user_email_and_name = require('../helpers/models/get_user_email_and_name');
const insert_auth_event = require('../helpers/insert_auth_event');
const redirect = require('../helpers/redirect');
const replace_session = require('../helpers/replace_session');
const send_email_nothrow = require('../helpers/send_email_nothrow');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_sign_in(req, res, user, ident, auth_event_custom)
{
    const replaced_session_uid = req.session.uid;
    await replace_session(req, user);
    await insert_auth_event({
        req,
        user,
        ident,
        event_type: const_auth_event.sign_in,
        custom: {...auth_event_custom, replaced_session_uid},
    });

    redirect(req, res);

    const email_and_name = await get_user_email_and_name(user.id);
    if (!email_and_name) {
        return;
    }
    await send_email_nothrow({
        name: const_email.new_sign_in,
        user,
        placeholders: {
            display_name: user.display_name,
            date: format_date_pretty_24(new Date()),
            ip: req.session.ip ?? 'n/a',
            ua: req.session.ua ?? 'n/a',
            reset_link: config.public_url + urlmod(config.pages.password_reset_request, {email: email_and_name?.email}),
            sessions_link: config.public_url + config.pages.sessions,
        },
    });
}

module.exports = complete_sign_in;
