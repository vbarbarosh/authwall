const open_e2e_db = require('./open_e2e_db');

// A fresh account with a password and a verified primary address. The address
// is marked in the database: the e2e mailer delivers nothing.
async function sign_up_with_primary(page, {primary = true} = {})
{
    const username = `pw${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const email = `${username}@authwall.test`;
    const status = await (await page.request.get('/auth/status')).json();
    await page.request.post('/auth/sign-up', {form: {username, email, password: 'pass1234', password_confirm: 'pass1234', _csrf: status.csrf_token}});

    await using db = open_e2e_db();
    if (primary) {
        const now = new Date();
        await db('user_identities').where({type: 'email', value_normalized: email}).update({verified_at: now, primary_at: now});
    }
    const {user_id} = await db('user_identities').where({type: 'email', value_normalized: email}).first();
    return {username, email, user_id};
}

module.exports = sign_up_with_primary;
