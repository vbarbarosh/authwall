const random_uid = require('./random_uid');

function random_uid_user_identity()
{
    return random_uid('awident_');
}

module.exports = random_uid_user_identity;
