const config = require('../../config');
const db = require('../../db');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const redirect = require('../helpers/redirect');
const send_email_nothrow = require('../helpers/send_email_nothrow');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_password_reset_request(req, res, user_id, email, token)
{
    redirect(req, res, config.pages.password_reset_notice);

    const user = await db('users').where('id', user_id).first();
    await send_email_nothrow({
        to: {name: user.display_name, email},
        path: fs_path_resolve(__dirname, '../../design/emails/password-reset.txt'),
        placeholders: {
            display_name: user.display_name,
            link: config.public_url + urlmod(config.pages.password_reset_confirm, {token}),
        },
    });
}

module.exports = complete_password_reset_request;
