const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_email = require('../helpers/const/const_email');
const db = require('../../db');
const insert_auth_event = require('../helpers/insert_auth_event');
const redirect = require('../helpers/redirect');
const send_email = require('../helpers/send_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_password_reset_request(req, res, ident, token, token_hash)
{
    const user = await db('users').where('id', ident.user_id).first();

    await send_email({
        name: const_email.password_reset,
        to: {name: user.display_name, email: ident.value},
        placeholders: {
            display_name: user.display_name,
            link: config.public_url + urlmod(config.pages.password_reset_confirm, {token}),
            token,
        },
    });

    await insert_auth_event({
        req,
        user,
        ident,
        event_type: const_auth_event.password_reset_requested,
        custom: {token_hash},
    });

    redirect(req, res, config.pages.password_reset_notice);
}

module.exports = complete_password_reset_request;
