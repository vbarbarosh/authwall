const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const authorize_email = require('../helpers/authorize_email');
const complete_email_verify_request = require('../actions/complete_email_verify_request');
const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_auth_event_status = require('../helpers/const/const_auth_event_status');
const const_user_identity = require('../helpers/const/const_user_identity');
const create_email_verify_token = require('../helpers/create_email_verify_token');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const db = require('../../db');
const insert_auth_event = require('../helpers/insert_auth_event');
const make_rate_limit_middleware = require('../helpers/middleware/rate_limit_middleware');
const normalize_email = require('../helpers/normalize/normalize_email');
const random_uid_user_identity = require('../helpers/random/random_uid_user_identity');

const SECOND = 1000;
const MINUTE = 60*SECOND;

// Every call sends a confirmation to an address the caller typed in.
const email_add_limiter = make_rate_limit_middleware(5, 60*MINUTE);

const routes = [
    {req: 'POST /auth/email/add', fn: [auth_middleware, csrf_middleware, email_add_limiter, email_add_post]},
];

// POST /auth/email/add
async function email_add_post(req, res)
{
    const {email} = req.body;
    if (!email) {
        throw new UserFriendlyError('Missing email');
    }

    const email_normalized = normalize_email(email);
    if (!email_normalized) {
        throw new UserFriendlyError('Invalid email');
    }
    await authorize_email(email_normalized);

    const user_id = req.session.user_id;
    const current_email_ident = await db('user_identities').where({user_id, type: const_user_identity.email}).first();
    if (current_email_ident) {
        await insert_auth_event({
            req,
            ident: current_email_ident,
            event_type: const_auth_event.identity_added,
            event_status: const_auth_event_status.noop,
            custom: {reason: 'email_already_connected'},
        });
        throw new UserFriendlyError('Email already connected');
    }

    const existing_ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first();
    if (existing_ident) {
        await insert_auth_event({
            req,
            ident: existing_ident,
            event_type: const_auth_event.identity_added,
            event_status: const_auth_event_status.failure,
            custom: {reason: 'email_already_registered'},
        });
        throw new UserFriendlyError('Email already registered');
    }

    // Same cooldown as a resend: an add/remove loop must not mail the
    // address more often than a verification request would.
    const recent = await db('email_verify_tokens').where({email_normalized}).orderBy('id', 'desc').first();
    if (recent && (Date.now() - new Date(recent.created_at).getTime()) < config.confirm_email.resend_cooldown_seconds * SECOND) {
        await insert_auth_event({
            req,
            ident: {type: const_user_identity.email, value: email, value_normalized: email_normalized},
            event_type: const_auth_event.identity_added,
            event_status: const_auth_event_status.noop,
            custom: {reason: 'verification_email_already_sent'},
        });
        throw new UserFriendlyError('Verification email already sent. Please wait.');
    }

    const now = new Date();
    const uid = random_uid_user_identity();
    await db.transaction(async function () {
        await db('user_identities').insert({
            uid,
            user_id,
            type: const_user_identity.email,
            value: email,
            value_normalized: email_normalized,
            created_at: now,
            updated_at: now,
            verified_at: null,
        });
    });
    const {token, code} = await create_email_verify_token(user_id, email_normalized, now);

    const ident = await db('user_identities').where({uid}).first();
    await insert_auth_event({
        req,
        ident,
        event_type: const_auth_event.identity_added,
    });
    await complete_email_verify_request(req, res, user_id, ident, token, code);
}

module.exports = routes;
