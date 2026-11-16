const als = require('../helpers/als');
const config = require('../../config');
const const_email = require('../helpers/const/const_email');
const const_user_identity = require('../helpers/const/const_user_identity');
const db = require('../../db');
const normalize_email = require('../helpers/normalize/normalize_email');
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
    // Account lookup and mail latency must not affect the public response.
    redirect(req, res, urlmod(config.pages.magic_link_notice, {email}));

    try {
        if (!config.sign_up.enabled) {
            const ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: normalize_email(email)}).whereNotNull('verified_at').first();
            if (!ident) {
                return;
            }
        }

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
    }
    catch (error) {
        // The response is already sent; a session error would reveal eligibility
        // on the next status request, even if the request itself looked uniform.
        als.logger.write(`[complete_magic_link_request_error] ${JSON.stringify(error.message)}`);
    }
}

module.exports = complete_magic_link_request;
