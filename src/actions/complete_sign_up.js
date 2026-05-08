const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_email = require('../helpers/const/const_email');
const insert_auth_event = require('../helpers/insert_auth_event');
const redirect = require('../helpers/redirect');
const replace_session = require('../helpers/replace_session');
const send_email_nothrow = require('../helpers/send_email_nothrow');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_sign_up(req, res, user, token, ident, auth_event_custom = {})
{
    const replaced_session_uid = req.session.uid;
    await replace_session(req, user);
    await insert_auth_event({
        req,
        user,
        ident,
        event_type: const_auth_event.sign_up,
        custom: {...auth_event_custom, replaced_session_uid},
    });

    redirect(req, res, token && config.email_verification.required ? config.pages.email_verify_notice : '/');

    if (token) {
        await send_email_nothrow({
            name: const_email.welcome_and_confirm_email,
            user,
            placeholders: {
                display_name: user.display_name,
                sign_in_link: config.public_url + config.pages.sign_in,
                link: config.public_url + urlmod(config.pages.email_verify_confirm, {token}),
            },
        });
    }
    else {
        await send_email_nothrow({
            name: const_email.welcome,
            user,
            placeholders: {
                display_name: user.display_name,
                sign_in_link: config.public_url + config.pages.sign_in,
            },
        });
    }
}

module.exports = complete_sign_up;
