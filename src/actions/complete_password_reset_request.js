const config = require('../../config');
const const_email = require('../helpers/const/const_email');
const db = require('../../db');
const redirect = require('../helpers/redirect');
const send_email = require('../helpers/send_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_password_reset_request(req, res, user_id, email, token)
{
    const user = await db('users').where('id', user_id).first();
    await send_email({
        name: const_email.password_reset,
        to: {name: user.display_name, email},
        placeholders: {
            display_name: user.display_name,
            link: config.public_url + urlmod(config.pages.password_reset_confirm, {token}),
            token,
        },
    });

    redirect(req, res, config.pages.password_reset_notice);
}

module.exports = complete_password_reset_request;
