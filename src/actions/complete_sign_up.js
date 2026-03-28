const redirect = require('../helpers/redirect');
const replace_session = require('../helpers/replace_session');

async function complete_sign_up(req, res, user)
{
    await replace_session(req, user);
    redirect(req, res);
}

module.exports = complete_sign_up;
