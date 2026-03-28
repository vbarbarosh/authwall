const config = require('../../config');
const redirect = require('../helpers/redirect');

async function complete_email_verify_confirm(req, res)
{
    redirect(req, res, config.pages.email_verify_success);
}

module.exports = complete_email_verify_confirm;
