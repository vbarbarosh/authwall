const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const assign_primary_email = require('../helpers/assign_primary_email');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const bcrypt = require('bcrypt');
const complete_email_verify_confirm = require('../actions/complete_email_verify_confirm');
const complete_email_verify_request = require('../actions/complete_email_verify_request');
const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_auth_event_status = require('../helpers/const/const_auth_event_status');
const const_user_identity = require('../helpers/const/const_user_identity');
const consume_one_time_token = require('../helpers/consume_one_time_token');
const create_email_verify_token = require('../helpers/create_email_verify_token');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const insert_auth_event = require('../helpers/insert_auth_event');
const is_code_budget_spent = require('../helpers/is_code_budget_spent');
const random_hex = require('@vbarbarosh/node-helpers/src/random_hex');
const redirect = require('../helpers/redirect');
const revoke_pending_tokens = require('../helpers/revoke_pending_tokens');
const save_session = require('../helpers/save_session');
const spend_attempt = require('../helpers/spend_attempt');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const SECOND = 1000;

const routes = [
    {req: `GET ${config.pages.email_verify_confirm}`, fn: email_verify_confirm_get},
    {prepend: [auth_middleware, csrf_middleware], routes: [
        {req: 'POST /auth/email-verify/request', fn: email_verify_request_post},
        {req: 'POST /auth/email-verify/confirm', fn: email_verify_confirm_post},
    ]},
];

// POST /auth/email-verify/request
async function email_verify_request_post(req, res)
{
    const user_id = req.session.user_id;

    const ident = await db('user_identities').where({user_id, type: const_user_identity.email}).whereNull('verified_at').first();
    if (!ident) {
        // No unverified email. If the user already has a verified one, their
        // session snapshot is just stale (they verified in another session) —
        // heal it and send them on, rather than showing an error.
        const verified = await db('user_identities').where({user_id, type: const_user_identity.email}).whereNotNull('verified_at').first();
        if (verified) {
            req.session.email = verified.value;
            req.session.email_verified_at = new Date(verified.verified_at).toJSON();
            delete req.session.error;
            await save_session(req);
            return redirect(req, res, config.pages.profile);
        }
        await insert_auth_event({
            req,
            event_type: const_auth_event.email_verification_requested,
            event_status: const_auth_event_status.noop,
            custom: {reason: 'no_unverified_email'},
        });
        throw new UserFriendlyError('No unverified email found');
    }

    const email_normalized = ident.value_normalized;

    // Rate-limit: prevent spamming
    const recent = await db('email_verify_tokens').where({email_normalized}).orderBy('id', 'desc').first();
    if (recent && (Date.now() - new Date(recent.created_at).getTime()) < config.confirm_email.resend_cooldown_seconds * SECOND) {
        await insert_auth_event({
            req,
            ident,
            event_type: const_auth_event.email_verification_requested,
            event_status: const_auth_event_status.noop,
            custom: {reason: 'verification_email_already_sent'},
        });
        throw new UserFriendlyError('Verification email already sent. Please wait.');
    }

    const now = new Date();
    const {token, code} = await create_email_verify_token(user_id, email_normalized, now);

    await complete_email_verify_request(req, res, user_id, ident, token, code);
}

// GET /auth/email-verify/confirm?token=xxx
async function email_verify_confirm_get(req, res)
{
    const {token} = req.query;
    if (!token) {
        throw new UserFriendlyError('Missing token');
    }

    const now = new Date();
    const record = await db('email_verify_tokens')
        .whereNull('used_at')
        .where('token_hash', crypto_hash_sha256(token).toString('base64url'))
        .where('expires_at', '>', now)
        .first();
    if (!record) {
        throw new UserFriendlyError('Invalid or expired verification link');
    }

    // The link proves who reads the mailbox, not who signed up (AW-25). Opened
    // outside the account's own browser, it hands over an account whose only
    // way in is its password: every session and the old password go. An
    // account with another way in (a provider, a confirmed address) waits for
    // the link in a browser signed in to it.
    const user_id = record.user_id;
    const elsewhere = (req.session?.user_id !== user_id);
    const other_way_in = await db('user_identities')
        .where({user_id})
        .whereNot({type: const_user_identity.username})
        .whereNot({type: const_user_identity.email, value_normalized: record.email_normalized})
        .whereNotNull('verified_at')
        .first();
    if (elsewhere && other_way_in) {
        req.session.error = 'Sign in to confirm this address';
        await save_session(req);
        res.redirect(urlmod(config.pages.sign_in, {return: req.originalUrl}));
        return;
    }
    const new_owner = elsewhere;
    const reset_token = random_hex();

    await db.transaction(async function () {
        if (!await consume_one_time_token('email_verify_tokens', record.id, now)) {
            throw new UserFriendlyError('Invalid or expired verification link');
        }
        await db('user_identities')
            .where({
                user_id,
                type: const_user_identity.email,
                value_normalized: record.email_normalized,
            })
            .whereNull('verified_at')
            .update({verified_at: now, updated_at: now});
        await assign_primary_email(user_id);
        if (new_owner) {
            await db('users').where({id: user_id}).update({password_hash: null, updated_at: now});
            await revoke_pending_tokens(user_id);
            await db('sessions').where({user_id}).del();
            await db('personal_access_tokens').where({user_id}).whereNull('revoked_at').update({revoked_at: now, updated_at: now});
            await db('password_reset_tokens').insert({
                user_id,
                token_hash: crypto_hash_sha256(reset_token).toString('base64url'),
                created_at: now,
                updated_at: now,
                expires_at: date_add_minutes(now, 10),
            });
        }
    });

    const ident = await db('user_identities').where({
        user_id,
        type: const_user_identity.email,
        value_normalized: record.email_normalized,
    }).first();

    if (new_owner) {
        await insert_auth_event({req, ident, event_type: const_auth_event.email_verified, custom: {new_owner: true}});
        res.redirect(urlmod(config.pages.password_reset_confirm, {token: reset_token}));
        return;
    }

    await complete_email_verify_confirm(req, res, ident);
}

// POST /auth/email-verify/confirm
async function email_verify_confirm_post(req, res)
{
    if (config.confirm_email.mode === 'link') {
        throw new UserFriendlyError('Email verification code is disabled');
    }

    const {code} = req.body;
    if (!code) {
        throw new UserFriendlyError('Missing code');
    }

    const user_id = req.session.user_id;
    const ident = await db('user_identities').where({user_id, type: const_user_identity.email}).whereNull('verified_at').first();
    if (!ident) {
        throw new UserFriendlyError('No unverified email found');
    }

    const now = new Date();
    const wrong_codes = req.app.locals.wrong_codes;
    if (wrong_codes.is_blocked(req.ip) || await is_code_budget_spent('email_verify_tokens', ident.value_normalized, now)) {
        throw new UserFriendlyError('Too many attempts. Try again later.');
    }

    const record = await db('email_verify_tokens')
        .where({
            user_id,
            email_normalized: ident.value_normalized,
        })
        .whereNull('used_at')
        .where('expires_at', '>', now)
        .orderBy('id', 'desc')
        .first();
    if (!record?.code_hash || !await spend_attempt('email_verify_tokens', record.id, config.confirm_email.max_attempts, now) || !await bcrypt.compare(code, record.code_hash)) {
        wrong_codes.record_failure(req.ip);
        throw new UserFriendlyError('Invalid or expired verification code');
    }

    await db.transaction(async function () {
        if (!await consume_one_time_token('email_verify_tokens', record.id, now)) {
            throw new UserFriendlyError('Invalid or expired verification code');
        }
        await db('user_identities')
            .where({
                user_id,
                type: const_user_identity.email,
                value_normalized: ident.value_normalized,
            })
            .whereNull('verified_at')
            .update({verified_at: now, updated_at: now});
        await assign_primary_email(user_id);
    });

    const fresh_ident = await db('user_identities').where({id: ident.id}).first();
    await complete_email_verify_confirm(req, res, fresh_ident);
}

module.exports = routes;
