const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const authorize_email = require('../helpers/authorize_email');
const complete_email_change_confirm = require('../actions/complete_email_change_confirm');
const complete_email_change_request = require('../actions/complete_email_change_request');
const config = require('../../config');
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

const SECOND = 1000;

const routes = [
    {req: `GET ${config.pages.email_change_confirm}`, fn: email_change_confirm_get},
    {prepend: [auth_middleware, csrf_middleware], routes: [
        {req: `POST ${config.pages.email_change_request}`, fn: email_change_request_post},
    ]},
];

// POST /auth/email-change/request
async function email_change_request_post(req, res)
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

    const ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first();
    if (ident) {
        await insert_auth_event({
            req,
            ident,
            event_type: const_auth_event.email_change_requested,
            event_status: const_auth_event_status.failure,
            custom: {reason: 'email_already_registered'},
        });
        throw new UserFriendlyError('Email already registered');
    }

    const user_id = req.session.user_id;
    const current_email_ident = await db('user_identities').where({user_id, type: const_user_identity.email}).first();
    if (!current_email_ident) {
        throw new UserFriendlyError('No email found');
    }

    // Rate-limit: prevent spamming
    const recent = await db('email_change_tokens').where({email_normalized}).orderBy('id', 'desc').first();
    if (recent && (Date.now() - new Date(recent.created_at).getTime()) < 60 * SECOND) {
        await insert_auth_event({
            req,
            ident: {
                type: const_user_identity.email,
                value: email,
                value_normalized: email_normalized,
            },
            event_type: const_auth_event.email_change_requested,
            event_status: const_auth_event_status.noop,
            custom: {reason: 'email_changed_already_requested'},
        });
        throw new UserFriendlyError('Email change already requested. Please wait.');
    }

    const token = random_hex();

    const now = new Date();
    await db('email_change_tokens').insert({
        user_id,
        email_normalized,
        token_hash: crypto_hash_sha256(token).toString('base64url'),
        created_at: now,
        updated_at: now,
        expires_at: date_add_minutes(new Date(), 30),
    });

    await complete_email_change_request(req, res, user_id, email, token, {
        type: const_user_identity.email,
        value: email,
        value_normalized: email_normalized,
    });
}

// GET /auth/email-change/confirm?token=xxx
async function email_change_confirm_get(req, res)
{
    const {token} = req.query;
    if (!token) {
        throw new UserFriendlyError('Missing token');
    }

    const now = new Date();
    const email_change = await db('email_change_tokens')
        .whereNull('used_at')
        .where('token_hash', crypto_hash_sha256(token).toString('base64url'))
        .where('expires_at', '>=', now)
        .first();

    if (!email_change) {
        throw new UserFriendlyError('Invalid or expired email change link');
    }

    const ident = await db('user_identities')
        .where({user_id: email_change.user_id, type: const_user_identity.email})
        .first();
    if (!ident) {
        throw new UserFriendlyError('No email found');
    }

    await db.transaction(async function () {
        await db('email_change_tokens').where({id: email_change.id}).update({used_at: now, updated_at: now});

        const old_email = ident.value;

        await db('user_identities').where({id: ident.id}).del();

        await db('user_identities').insert({
            uid: random_uid_user_identity(),
            user_id: email_change.user_id,
            type: const_user_identity.email,
            value: email_change.email_normalized,
            value_normalized: email_change.email_normalized,
            created_at: now,
            updated_at: now,
            verified_at: now,
        });

        const user_id = email_change.user_id;
        const new_email = email_change.email_normalized;
        await complete_email_change_confirm(req, res, user_id, old_email, new_email);
    });
}

module.exports = routes;
