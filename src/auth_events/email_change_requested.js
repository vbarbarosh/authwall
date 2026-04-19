const const_auth_event = require('../helpers/const/const_auth_event');
const insert_auth_event = require('../helpers/insert_auth_event');

async function email_change_requested(req, params = {})
{
    return insert_auth_event(req, {...params, event_type: const_auth_event.email_change_requested});
}

module.exports = email_change_requested;
