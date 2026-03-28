const config = require('../../config');
const format_date_pretty_24 = require('../helpers/format/format_date_pretty_24');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const get_user_email_and_name = require('../helpers/models/get_user_email_and_name');
const redirect = require('../helpers/redirect');
const replace_session = require('../helpers/replace_session');
const send_email = require('../helpers/send_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_sign_in(req, res, user)
{
    await replace_session(req, user);

    redirect(req, res);

    const email_and_name = await get_user_email_and_name(user.id);
    await send_email({
        user,
        path: fs_path_resolve(__dirname, '../../design/emails/new-sign-in.txt'),
        placeholders: {
            display_name: user.display_name,
            date: format_date_pretty_24(new Date()),
            ip: req.session.ip ?? 'n/a',
            ua: req.session.ua ?? 'n/a',
            reset_link: config.public_url + urlmod(config.pages.password_reset_request, {email: email_and_name?.email}),
            sessions_link: config.public_url + config.pages.sessions,
        },
    });
}

module.exports = complete_sign_in;
