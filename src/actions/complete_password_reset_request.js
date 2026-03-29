const config = require('../../config');
const db = require('../../db');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const redirect = require('../helpers/redirect');
const send_email = require('../helpers/send_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_password_reset_request(req, res, user_id, email, token)
{
    const user = await db('users').where('id', user_id).first();
    await send_email({
        to: {name: user.display_name, email},
        path: fs_path_resolve(__dirname, '../../design/emails/password-reset.txt'),
        placeholders: {
            display_name: user.display_name,
            link: config.public_url + urlmod(config.pages.password_reset_confirm, {token}),
        },
    });

    redirect(req, res, config.pages.password_reset_notice);
}

module.exports = complete_password_reset_request;
