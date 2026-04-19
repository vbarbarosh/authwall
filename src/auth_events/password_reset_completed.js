const const_auth_event = require('../helpers/const/const_auth_event');
const insert_auth_event = require('../helpers/insert_auth_event');

async function password_reset_completed(req, params = {})
{
    return insert_auth_event(req, {...params, event_type: const_auth_event.password_reset_completed});
}

module.exports = password_reset_completed;
