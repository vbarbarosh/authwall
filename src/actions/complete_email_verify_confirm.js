const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const insert_auth_event = require('../helpers/insert_auth_event');
const redirect = require('../helpers/redirect');
const save_session = require('../helpers/save_session');

async function complete_email_verify_confirm(req, res, ident)
{
    await insert_auth_event({
        req,
        ident,
        event_type: const_auth_event.email_verified,
    });

    if (config.confirm_email.required && req.session?.user_id === ident.user_id) {
        req.session.email = ident.value;
        req.session.email_verified_at = ident.verified_at ? new Date(ident.verified_at).toJSON() : null;
        await save_session(req);
    }

    redirect(req, res, config.pages.email_verify_success);
}

module.exports = complete_email_verify_confirm;
