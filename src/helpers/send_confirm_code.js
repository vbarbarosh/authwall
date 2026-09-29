const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const bcrypt = require('bcrypt');
const config = require('../../config');
const const_auth_event = require('./const/const_auth_event');
const const_email = require('./const/const_email');
const const_user_identity = require('./const/const_user_identity');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const insert_auth_event = require('./insert_auth_event');
const random_code = require('./random/random_code');
const send_email = require('./send_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const CODE_MINUTES = 10;
const RESEND_COOLDOWN_MS = 60*1000;

// Mails a code to the signed-in account's primary address, for the owner to
// confirm it is them (see routes/confirm.js).
async function send_confirm_code(req)
{
    const user_id = req.session.user_id;
    const primary = await db('user_identities').where({user_id, type: const_user_identity.email}).whereNotNull('primary_at').first();
    if (!primary) {
        throw new UserFriendlyError('Your account has no primary address. Confirm with your password.');
    }
    if (!config.mailer.enabled) {
        throw new UserFriendlyError('Email delivery is disabled. Confirm with your password.');
    }

    const recent = await db('confirm_codes').where({user_id}).orderBy('id', 'desc').first();
    if (recent && ((Date.now() - new Date(recent.created_at).getTime()) < RESEND_COOLDOWN_MS)) {
        throw new UserFriendlyError('Code already sent. Please wait.');
    }

    const code = random_code();
    const now = new Date();
    await db('confirm_codes').insert({
        user_id,
        email_normalized: primary.value_normalized,
        code_hash: await bcrypt.hash(code, config.bcrypt_rounds),
        created_at: now,
        updated_at: now,
        expires_at: date_add_minutes(now, CODE_MINUTES),
    });
    await insert_auth_event({req, ident: primary, event_type: const_auth_event.identity_confirmation_requested});

    const user = await db('users').where({id: user_id}).first();
    await send_email({
        name: const_email.confirm_code,
        to: {name: user.display_name, email: primary.value},
        placeholders: {
            display_name: user.display_name,
            code,
            expires_minutes: CODE_MINUTES,
            reset_link: config.public_url + urlmod(config.pages.password_reset_request, {email: primary.value}),
        },
    });
}

module.exports = send_confirm_code;
