const const_auth_event = require('../helpers/const/const_auth_event');
const insert_auth_event = require('../helpers/insert_auth_event');

async function session_revoked_all(req, params = {})
{
    return insert_auth_event(req, {...params, event_type: const_auth_event.session_revoked_all});
}

module.exports = session_revoked_all;
