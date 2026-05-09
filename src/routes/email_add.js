const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const authorize_email = require('../helpers/authorize_email');
const complete_email_verify_request = require('../actions/complete_email_verify_request');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_auth_event_status = require('../helpers/const/const_auth_event_status');
const const_user_identity = require('../helpers/const/const_user_identity');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const insert_auth_event = require('../helpers/insert_auth_event');
const normalize_email = require('../helpers/normalize/normalize_email');
const random_hex = require('@vbarbarosh/node-helpers/src/random_hex');
const random_uid_user_identity = require('../helpers/random/random_uid_user_identity');

const routes = [
    {req: 'POST /auth/email/add', fn: [auth_middleware, csrf_middleware, email_add_post]},
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

    const token = random_hex();
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
        await db('email_verify_tokens').insert({
            user_id,
            email_normalized,
            token_hash: crypto_hash_sha256(token).toString('base64url'),
            created_at: now,
            updated_at: now,
            expires_at: date_add_minutes(new Date(), 30),
        });
    });

    const ident = await db('user_identities').where({uid}).first();
    await insert_auth_event({
        req,
        ident,
        event_type: const_auth_event.identity_added,
    });
    await complete_email_verify_request(req, res, user_id, ident, token);
}

module.exports = routes;
