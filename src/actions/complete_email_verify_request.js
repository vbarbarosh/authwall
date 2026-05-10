const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_email = require('../helpers/const/const_email');
const db = require('../../db');
const insert_auth_event = require('../helpers/insert_auth_event');
const redirect = require('../helpers/redirect');
const send_email = require('../helpers/send_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const confirm_email_mode_to_email = {
    link: const_email.confirm_email_without_code,
    code: const_email.confirm_email_without_link,
    link_and_code: const_email.confirm_email,
};

async function complete_email_verify_request(req, res, user_id, ident, token, code)
{
    const user = await db('users').where('id', user_id).first();

    await send_email({
        name: confirm_email_mode_to_email[config.confirm_email.mode],
        to: {name: user.display_name, email: ident.value},
        placeholders: {
            display_name: user.display_name,
            link: config.public_url + urlmod(config.pages.email_verify_confirm, {token}),
            code,
            expires_minutes: config.confirm_email.expires_minutes,
        },
    });

    await insert_auth_event({
        req,
        user,
        ident,
        event_type: const_auth_event.email_verification_requested,
    });

    redirect(req, res, config.pages.email_verify_notice);
}

module.exports = complete_email_verify_request;
