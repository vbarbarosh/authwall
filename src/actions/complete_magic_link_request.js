const config = require('../../config');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const redirect = require('../helpers/redirect');
const send_email = require('../helpers/send_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_magic_link_request(req, res, email, code, token)
{
    await send_email({
        to: {email},
        path: fs_path_resolve(__dirname, '../../design/emails/magic-link.txt'),
        placeholders: {
            display_name: '',
            code,
            link: config.public_url + urlmod(config.pages.magic_link_confirm, {token}),
        },
    });

    redirect(req, res, urlmod(config.pages.magic_link_notice, {email}));
}

module.exports = complete_magic_link_request;
