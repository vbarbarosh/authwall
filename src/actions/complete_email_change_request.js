const config = require('../../config');
const const_email = require('../helpers/const/const_email');
const db = require('../../db');
const redirect = require('../helpers/redirect');
const send_email = require('../helpers/send_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const insert_auth_event = require('../helpers/insert_auth_event');
const const_auth_event = require('../helpers/const/const_auth_event');

async function complete_email_change_request(req, res, user_id, new_email, token, ident)
{
    const user = await db('users').where('id', user_id).first();

    await send_email({
        name: const_email.email_change_requested,
        to: {name: user.display_name, email: new_email},
        placeholders: {
            display_name: user.display_name,
            confirm_link: config.public_url + urlmod(config.pages.email_change_confirm, {token}),
            new_email,
            token,
        },
    });

    await insert_auth_event({
        req,
        ident,
        event_type: const_auth_event.email_change_requested,
        custom: {new_email},
    });

    redirect(req, res, config.pages.email_change_notice);
}

module.exports = complete_email_change_request;
