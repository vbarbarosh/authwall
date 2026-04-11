const config = require('../../config');
const const_email = require('../helpers/const/const_email');
const db = require('../../db');
const format_date_pretty_24 = require('../helpers/format/format_date_pretty_24');
const redirect = require('../helpers/redirect');
const replace_session = require('../helpers/replace_session');
const send_email_nothrow = require('../helpers/send_email_nothrow');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

async function complete_password_change(req, res, user_id)
{
    const user = await db('users').where({id: user_id}).first();

    await replace_session(req, user);
    redirect(req, res, config.pages.profile);

    await send_email_nothrow({
        name: const_email.password_changed_from_profile,
        user,
        placeholders: {
            display_name: user.display_name,
            date: format_date_pretty_24(),
            ip: req.session.ip ?? 'n/a',
            ua: req.session.ua ?? 'n/a',
            reset_link: config.public_url + urlmod(config.pages.password_reset_request),
        },
    });
}

module.exports = complete_password_change;
