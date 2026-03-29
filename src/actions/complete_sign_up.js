const config = require('../../config');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const redirect = require('../helpers/redirect');
const replace_session = require('../helpers/replace_session');
const send_email_nothrow = require('../helpers/send_email_nothrow');

async function complete_sign_up(req, res, user)
{
    await replace_session(req, user);

    redirect(req, res);

    await send_email_nothrow({
        user,
        path: fs_path_resolve(__dirname, '../../design/emails/welcome.txt'),
        placeholders: {
            display_name: user.display_name,
            sign_in_link: config.public_url + config.pages.sign_in,
        },
    });
}

module.exports = complete_sign_up;
