const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_email = require('../helpers/const/const_email');
const const_user_identity = require('../helpers/const/const_user_identity');
const db = require('../../db');
const format_date_pretty_24 = require('../helpers/format/format_date_pretty_24');
const insert_auth_event = require('../helpers/insert_auth_event');
const normalize_email = require('../helpers/normalize/normalize_email');
const redirect = require('../helpers/redirect');
const send_email = require('../helpers/send_email');

async function complete_email_change_confirm(req, res, user_id, old_email, new_email)
{
    const user = await db('users').where('id', user_id).first();

    await send_email({
        name: const_email.email_changed,
        to: {name: user.display_name, email: old_email},
        placeholders: {
            display_name: user.display_name,
            date: format_date_pretty_24(new Date()),
            ip: req.session.ip ?? 'n/a',
            ua: req.session.ua ?? 'n/a',
            new_email,
            reset_link: config.public_url + config.pages.password_reset_request,
        },
    });

    await insert_auth_event({
        req,
        user,
        ident: {
            type: const_user_identity.email,
            value: new_email,
            value_normalized: normalize_email(new_email),
        },
        event_type: const_auth_event.email_changed,
        custom: {
            old_email,
        },
    });

    redirect(req, res, config.pages.email_change_success);
}

module.exports = complete_email_change_confirm;
