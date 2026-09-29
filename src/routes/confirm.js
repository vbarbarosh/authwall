const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const bcrypt = require('bcrypt');
const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_auth_event_status = require('../helpers/const/const_auth_event_status');
const const_email = require('../helpers/const/const_email');
const const_user_identity = require('../helpers/const/const_user_identity');
const consume_one_time_token = require('../helpers/consume_one_time_token');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const insert_auth_event = require('../helpers/insert_auth_event');
const make_rate_limit_middleware = require('../helpers/middleware/rate_limit_middleware');
const random_code = require('../helpers/random/random_code');
const redirect = require('../helpers/redirect');
const save_session = require('../helpers/save_session');
const send_email = require('../helpers/send_email');
const spend_attempt = require('../helpers/spend_attempt');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const SECOND = 1000;
const MINUTE = 60*SECOND;

const CODE_MINUTES = 10;
const CODE_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN = 60*SECOND;

// One budget for wrong codes and wrong passwords, across codes and processes:
// counted from the failure events in the database, not in memory.
const FAILURES_MAX = 5;
const FAILURES_WINDOW = 15*MINUTE;

const confirm_request_limiter = make_rate_limit_middleware(5, 60*MINUTE);

const routes = [
    {prepend: [auth_middleware, csrf_middleware], routes: [
        {req: 'POST /auth/confirm/request', prepend: [confirm_request_limiter], fn: confirm_request_post},
        {req: 'POST /auth/confirm', fn: confirm_post},
    ]},
];

// POST /auth/confirm/request
async function confirm_request_post(req, res)
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
    if (recent && ((Date.now() - new Date(recent.created_at).getTime()) < RESEND_COOLDOWN)) {
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

    redirect(req, res, config.pages.profile);
}

// POST /auth/confirm (code | password)
async function confirm_post(req, res)
{
    const user_id = req.session.user_id;
    const {code, password} = req.body;
    const method = (typeof code === 'string') ? 'code' : 'password';
    if ((typeof code !== 'string') && (typeof password !== 'string')) {
        throw new UserFriendlyError('Missing fields');
    }

    const since = new Date(Date.now() - FAILURES_WINDOW);
    const [{failures}] = await db('auth_events')
        .where({user_id, event_type: const_auth_event.identity_confirmed, event_status: const_auth_event_status.failure})
        .where('created_at', '>', since)
        .count('* as failures');
    if (Number(failures) >= FAILURES_MAX) {
        throw new UserFriendlyError('Too many attempts. Try again later.');
    }

    const now = new Date();
    const ok = (method === 'code') ? await confirm_by_code(user_id, code, now) : await confirm_by_password(user_id, password);
    if (!ok) {
        await insert_auth_event({req, event_type: const_auth_event.identity_confirmed, event_status: const_auth_event_status.failure, custom: {method}});
        throw new UserFriendlyError((method === 'code') ? 'Invalid or expired code' : 'Password is incorrect');
    }

    // Read by the actions that need the owner, for a few minutes.
    req.session.confirmed_at = now.toJSON();
    await save_session(req);
    await insert_auth_event({req, event_type: const_auth_event.identity_confirmed, custom: {method}});

    redirect(req, res, config.pages.profile);
}

async function confirm_by_code(user_id, code, now)
{
    const record = await db('confirm_codes')
        .where({user_id})
        .whereNull('used_at')
        .where('expires_at', '>', now)
        .orderBy('id', 'desc')
        .first();
    if (!record) {
        return false;
    }
    if (!await spend_attempt('confirm_codes', record.id, CODE_MAX_ATTEMPTS, now)) {
        return false;
    }
    if (!await bcrypt.compare(code, record.code_hash)) {
        return false;
    }
    return consume_one_time_token('confirm_codes', record.id, now);
}

async function confirm_by_password(user_id, password)
{
    const user = await db('users').where({id: user_id}).first();
    if (user.password_hash === null) {
        throw new UserFriendlyError('Your account has no password. Confirm with a code sent to your primary address.');
    }
    return bcrypt.compare(password, user.password_hash);
}

module.exports = routes;
