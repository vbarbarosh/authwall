const random_uid = require('./random_uid');

function random_uid_auth_event()
{
    return random_uid('awevt_');
}

module.exports = random_uid_auth_event;
