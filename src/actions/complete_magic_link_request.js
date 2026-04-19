const config = require('../../config');
const const_email = require('../helpers/const/const_email');
const redirect = require('../helpers/redirect');
const send_email = require('../helpers/send_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const magic_link_mode_to_email = {
    link: const_email.magic_link_without_code,
    code: const_email.magic_link_without_link,
    link_and_code: const_email.magic_link,
};

async function complete_magic_link_request(req, res, email, code, token)
{
    await send_email({
        name: magic_link_mode_to_email[config.flows.magic_link.mode],
        to: {email},
        placeholders: {
            display_name: '',
            link: config.public_url + urlmod(config.pages.magic_link_confirm, {token}),
            code,
            token,
        },
    });

    redirect(req, res, urlmod(config.pages.magic_link_notice, {email}));
}

module.exports = complete_magic_link_request;
