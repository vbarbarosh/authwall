const config = require('../../config');
const db = require('../../db');
const format_date_pretty_24 = require('../helpers/format/format_date_pretty_24');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const redirect = require('../helpers/redirect');
const replace_session = require('../helpers/replace_session');
const send_email_nothrow = require('../helpers/send_email_nothrow');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_password_change(req, res, user_id)
{
    const user = await db('users').where({id: user_id}).first();

    await replace_session(req, user);
    redirect(req, res, config.pages.profile);

    await send_email_nothrow({
        user,
        path: fs_path_resolve(__dirname, '../../design/emails/password-changed-from-profile.txt'),
        placeholders: {
            display_name: user.display_name,
            date: format_date_pretty_24(),
            ip: req.session.ip ?? 'n/a',
            ua: req.session.ua ?? 'n/a',
            reset_link: config.public_url + urlmod(config.pages.password_reset_request),
        },
    });
}

module.exports = complete_password_change;
