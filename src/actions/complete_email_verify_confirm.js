const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const insert_auth_event = require('../helpers/insert_auth_event');
const redirect = require('../helpers/redirect');

async function complete_email_verify_confirm(req, res, ident)
{
    await insert_auth_event({
        req,
        ident,
        event_type: const_auth_event.email_verified,
    });

    redirect(req, res, config.pages.email_verify_success);
}

module.exports = complete_email_verify_confirm;
