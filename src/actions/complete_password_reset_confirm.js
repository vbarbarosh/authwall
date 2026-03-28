const config = require('../../config');
const db = require('../../db');
const format_date_pretty_24 = require('../helpers/format/format_date_pretty_24');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const redirect = require('../helpers/redirect');
const send_email = require('../helpers/send_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_password_reset_confirm(req, res, user_id)
{
    redirect(req, res, config.pages.sign_in);

    const user = await db('users').where({id: user_id}).first();
    await send_email({
        user,
        path: fs_path_resolve(__dirname, '../../design/emails/password-changed.txt'),
        placeholders: {
            display_name: user.display_name,
            date: format_date_pretty_24(),
            ip: req.session.ip ?? 'n/a',
            ua: req.session.ua ?? 'n/a',
            reset_link: config.public_url + urlmod(config.pages.password_reset_request),
        },
    });
}

module.exports = complete_password_reset_confirm;
