const const_auth_event = require('../helpers/const/const_auth_event');
const insert_auth_event = require('../helpers/insert_auth_event');

async function sign_out(req, params = {})
{
    return insert_auth_event(req, {...params, event_type: const_auth_event.sign_out});
}

module.exports = sign_out;
