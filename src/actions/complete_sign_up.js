const config = require('../../config');
const const_email = require('../helpers/const/const_email');
const redirect = require('../helpers/redirect');
const replace_session = require('../helpers/replace_session');
const send_email_nothrow = require('../helpers/send_email_nothrow');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_sign_up(req, res, user, token)
{
    await replace_session(req, user);

    redirect(req, res);

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
