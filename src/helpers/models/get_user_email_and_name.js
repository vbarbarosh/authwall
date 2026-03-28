const const_user_identity = require('../const/const_user_identity');
const db = require('../../../db');

async function get_user_email_and_name(user_id)
{
    const ident = await db('user_identities').where({type: const_user_identity.email, user_id}).first();
    if (!ident) {
        return null;
    }

    const user = await db('users').where({id: user_id}).first();
    return {name: user.display_name, email: ident.value};
}

module.exports = get_user_email_and_name;
