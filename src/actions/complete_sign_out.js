const config = require('../../config');
const destroy_session = require('../helpers/destroy_session');
const redirect = require('../helpers/redirect');

async function complete_sign_out(req, res)
{
    await destroy_session(req);
    redirect(req, res, config.pages.sign_in);
}

module.exports = complete_sign_out;
