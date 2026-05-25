const random_uid = require('./random_uid');

function random_uid_personal_access_token()
{
    return random_uid('awpat_');
}

module.exports = random_uid_personal_access_token;
