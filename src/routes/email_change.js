const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const assign_primary_email = require('../helpers/assign_primary_email');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const authorize_email = require('../helpers/authorize_email');
const complete_email_change_confirm = require('../actions/complete_email_change_confirm');
const complete_email_change_request = require('../actions/complete_email_change_request');
const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_auth_event_status = require('../helpers/const/const_auth_event_status');
const const_email = require('../helpers/const/const_email');
const const_user_identity = require('../helpers/const/const_user_identity');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const insert_auth_event = require('../helpers/insert_auth_event');
const is_recently_confirmed = require('../helpers/is_recently_confirmed');
const make_rate_limit_middleware = require('../helpers/middleware/rate_limit_middleware');
const normalize_email = require('../helpers/normalize/normalize_email');
const random_hex = require('@vbarbarosh/node-helpers/src/random_hex');
const random_uid_user_identity = require('../helpers/random/random_uid_user_identity');
const redirect = require('../helpers/redirect');
const revoke_pending_tokens = require('../helpers/revoke_pending_tokens');
const send_email = require('../helpers/send_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const SECOND = 1000;
const MINUTE = 60*SECOND;

// Every call sends a confirmation to an address the caller typed in.
const email_change_limiter = make_rate_limit_middleware(5, 60*MINUTE);

const routes = [
    {req: `GET ${config.pages.email_change_approve}`, fn: email_change_approve_get},
    {req: `GET ${config.pages.email_change_confirm}`, fn: email_change_confirm_get},
    {prepend: [auth_middleware, csrf_middleware], routes: [
        {req: `POST ${config.pages.email_change_request}`, prepend: [email_change_limiter], fn: email_change_request_post},
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

    // The current primary approves a move away from it. An account without a
    // primary has no one to ask, so the owner confirms it is them first.
    const primary = await db('user_identities').where({user_id, type: const_user_identity.email}).whereNotNull('primary_at').first();
    if (!primary && !is_recently_confirmed(req)) {
        throw new UserFriendlyError('Confirm it is you before changing your email');
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

    // With a primary, the new address gets its link only once the primary
    // approves (email_change_approve_get); the token stored here is never sent.
    const token = random_hex();
    const approve_token = primary ? random_hex() : null;
    const now = new Date();
    await db('email_change_tokens').insert({
        user_id,
        email,
        email_normalized,
        token_hash: crypto_hash_sha256(token).toString('base64url'),
        approve_token_hash: approve_token && crypto_hash_sha256(approve_token).toString('base64url'),
        approved_at: primary ? null : now,
        created_at: now,
        updated_at: now,
        expires_at: date_add_minutes(now, 30),
    });

    await insert_auth_event({
        req,
        ident: {type: const_user_identity.email, value: email, value_normalized: email_normalized},
        event_type: const_auth_event.email_change_requested,
        custom: {new_email: email, approval: primary ? 'primary' : 'confirmed'},
    });

    if (!primary) {
        await complete_email_change_request(req, res, user_id, email, token);
        return;
    }

    const user = await db('users').where({id: user_id}).first();
    await send_email({
        name: const_email.email_change_approve,
        to: {name: user.display_name, email: primary.value},
        placeholders: {
            display_name: user.display_name,
            new_email: email,
            approve_link: config.public_url + urlmod(config.pages.email_change_approve, {token: approve_token}),
            expires_minutes: 30,
            token: approve_token,
        },
    });
    redirect(req, res, config.pages.email_change_notice);
}

// GET /auth/email-change/approve?token=xxx (the link mailed to the current primary)
async function email_change_approve_get(req, res)
{
    const {token} = req.query;
    if (!token) {
        throw new UserFriendlyError('Missing token');
    }

    const now = new Date();
    const email_change = await db('email_change_tokens')
        .whereNull('used_at')
        .whereNull('approved_at')
        .where('approve_token_hash', crypto_hash_sha256(token).toString('base64url'))
        .where('expires_at', '>=', now)
        .first();
    if (!email_change) {
        throw new UserFriendlyError('Invalid or expired approval link');
    }

    // Only now does the new address get a link, with a window of its own.
    const confirm_token = random_hex();
    const approved = await db('email_change_tokens')
        .where({id: email_change.id})
        .whereNull('approved_at')
        .update({
            approved_at: now,
            token_hash: crypto_hash_sha256(confirm_token).toString('base64url'),
            expires_at: date_add_minutes(now, 30),
            updated_at: now,
        });
    if (approved !== 1) {
        throw new UserFriendlyError('Invalid or expired approval link');
    }

    await insert_auth_event({
        req,
        user: {id: email_change.user_id},
        ident: {type: const_user_identity.email, value: email_change.email, value_normalized: email_change.email_normalized},
        event_type: const_auth_event.email_change_approved,
    });
    await complete_email_change_request(req, res, email_change.user_id, email_change.email, confirm_token);
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
        .whereNotNull('approved_at')
        .where('token_hash', crypto_hash_sha256(token).toString('base64url'))
        .where('expires_at', '>=', now)
        .first();

    if (!email_change) {
        throw new UserFriendlyError('Invalid or expired email change link');
    }

    // The change replaces the primary; an account without one, its only address.
    const ident = await db('user_identities')
        .where({user_id: email_change.user_id, type: const_user_identity.email})
        .orderByRaw('primary_at IS NULL')
        .orderBy('id')
        .first();
    if (!ident) {
        throw new UserFriendlyError('No email found');
    }

    await db.transaction(async function () {
        await db('email_change_tokens').where({id: email_change.id}).update({used_at: now, updated_at: now});

        const old_email = ident.value;

        await db('user_identities').where({id: ident.id}).del();

        // A reset link was delivered to the old address, and that address is
        // no longer the account's: whoever reads its mailbox now must not be
        // able to finish a recovery it started, nor a sibling change link
        // undo this one.
        await revoke_pending_tokens(email_change.user_id);

        await db('user_identities').insert({
            uid: random_uid_user_identity(),
            user_id: email_change.user_id,
            type: const_user_identity.email,
            value: email_change.email,
            value_normalized: email_change.email_normalized,
            created_at: now,
            updated_at: now,
            verified_at: now,
            // The address it replaces stays primary under its new value.
            primary_at: ident.primary_at,
        });
        await assign_primary_email(email_change.user_id);

        const user_id = email_change.user_id;
        const new_email = email_change.email;
        await complete_email_change_confirm(req, res, user_id, old_email, new_email);
    });
}

module.exports = routes;
