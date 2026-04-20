const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const destroy_session = require('../helpers/destroy_session');
const insert_auth_event = require('../helpers/insert_auth_event');
const redirect = require('../helpers/redirect');

async function complete_sign_out(req, res)
{
    await insert_auth_event({req, event_type: const_auth_event.sign_out});
    await destroy_session(req);
    redirect(req, res, config.pages.sign_in);
}

module.exports = complete_sign_out;
