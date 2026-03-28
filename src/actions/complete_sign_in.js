const config = require('../../config');
const format_date_pretty_24 = require('../helpers/format/format_date_pretty_24');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const redirect = require('../helpers/redirect');
const replace_session = require('../helpers/replace_session');
const send_email = require('../helpers/send_email');

async function complete_sign_in(req, res, user)
{
    await replace_session(req, user);

    redirect(req, res);

    await send_email({
        user,
        path: fs_path_resolve(__dirname, '../../design/emails/new-sign-in.txt'),
        placeholders: {
            date: format_date_pretty_24(new Date()),
            ip: req.session.ip,
            ua: req.session.ua,
            reset_link: config.public_url + config.pages.reset_link,
            sessions_link: config.public_url + config.pages.sessions,
        },
    });
}

module.exports = complete_sign_in;
