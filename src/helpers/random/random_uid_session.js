const random_uid = require('./random_uid');

function random_uid_session()
{
    return random_uid('awsess_');
}

module.exports = random_uid_session;
