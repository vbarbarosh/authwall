const auth_middleware = require('../helpers/middleware/auth_middleware');
const complete_email_verify_confirm = require('../actions/complete_email_verify_confirm');
const complete_email_verify_request = require('../actions/complete_email_verify_request');
const config = require('../../config');
const const_user_identity = require('../helpers/const/const_user_identity');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const random_hex = require('@vbarbarosh/node-helpers/src/random_hex');

const SECOND = 1000;

const routes = [
    {req: `GET ${config.pages.email_verify_confirm}`, fn: email_verify_confirm_get},
    {prepend: [auth_middleware, csrf_middleware], routes: [
        {req: 'POST /auth/email-verify/request', fn: email_verify_request_post},
    ]},
];

// POST /auth/email-verify/request
async function email_verify_request_post(req, res)
{
    const user_id = req.session.user_id;

    const ident = await db('user_identities').where({user_id, type: const_user_identity.email}).whereNull('verified_at').first();
    if (!ident) {
        throw new Error('No unverified email found');
    }

    const email_normalized = ident.value_normalized;

    // Rate-limit: prevent spamming
    const recent = await db('email_verify_tokens').where({email_normalized}).orderBy('id', 'desc').first();
    if (recent && (Date.now() - new Date(recent.created_at).getTime()) < 60 * SECOND) {
        throw new Error('Verification email already sent. Please wait.');
    }

    const token = random_hex();

    const now = new Date();
    await db('email_verify_tokens').insert({
        user_id,
        email_normalized,
        token_hash: crypto_hash_sha256(token),
        created_at: now,
        updated_at: now,
        expires_at: date_add_minutes(new Date(), 30),
    });

    await complete_email_verify_request(req, res, user_id, ident.value, token);
}

// GET /auth/email-verify/confirm?token=xxx
async function email_verify_confirm_get(req, res)
{
    const {token} = req.query;
    if (!token) {
        throw new Error('Missing token');
    }

    const now = new Date();
    const record = await db('email_verify_tokens')
        .whereNull('used_at')
        .where('token_hash', crypto_hash_sha256(token))
        .where('expires_at', '>', now)
        .first();
    if (!record) {
        throw new Error('Invalid or expired verification link');
    }

    await db.transaction(async function (trx) {
        await trx('email_verify_tokens').where({id: record.id}).update({used_at: now, updated_at: now});
        await trx('user_identities')
            .where({
                user_id: record.user_id,
                type: const_user_identity.email,
                value_normalized: record.email_normalized,
            })
            .whereNull('verified_at')
            .update({verified_at: now, updated_at: now});
    });

    await complete_email_verify_confirm(req, res);
}

module.exports = routes;
