const auth_middleware = require('../helpers/middleware/auth_middleware');
const complete_email_change_confirm = require('../actions/complete_email_change_confirm');
const complete_email_change_request = require('../actions/complete_email_change_request');
const config = require('../../config');
const const_user_identity = require('../helpers/const/const_user_identity');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const normalize_email = require('../helpers/normalize/normalize_email');
const random_hex = require('@vbarbarosh/node-helpers/src/random_hex');

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
        throw new Error('Missing email');
    }

    const email_normalized = normalize_email(email);
    const ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first();
    if (ident) {
        throw new Error('Email already registered');
    }

    // Rate-limit: prevent spamming
    const recent = await db('email_change_tokens').where({email_normalized}).orderBy('id', 'desc').first();
    if (recent && (Date.now() - new Date(recent.created_at).getTime()) < 60 * SECOND) {
        throw new Error('Email change already requested. Please wait.');
    }

    const user_id = req.session.user_id;
    const token = random_hex();

    const now = new Date();
    await db('email_change_tokens').insert({
        user_id,
        email_normalized,
        token_hash: crypto_hash_sha256(token),
        created_at: now,
        updated_at: now,
        expires_at: date_add_minutes(new Date(), 30),
    });

    await complete_email_change_request(req, res, user_id, email, token);
}

// GET /auth/email-change/confirm?token=xxx
async function email_change_confirm_get(req, res)
{
    const {token} = req.query;
    if (!token) {
        throw new Error('Missing token');
    }

    const now = new Date();
    const record = await db('email_change_tokens')
        .whereNull('used_at')
        .where('token_hash', crypto_hash_sha256(token))
        .where('expires_at', '>', now)
        .first();

    if (!record) {
        throw new Error('Invalid or expired email change link');
    }

    await db.transaction(async function () {
        await db('email_change_tokens').where({id: record.id}).update({used_at: now, updated_at: now});

        const ident = await db('user_identities')
            .where({user_id: record.user_id, type: const_user_identity.email})
            .first();

        const old_email = ident?.value ?? null;

        await db('user_identities').where({id: record.id}).del();

        await db('user_identities').insert({
            user_id: record.user_id,
            type: const_user_identity.email,
            value: record.email_normalized,
            value_normalized: record.email_normalized,
            created_at: now,
            updated_at: now,
            verified_at: now,
        });

        const user_id = record.user_id;
        const new_email = record.email_normalized;
        await complete_email_change_confirm(req, res, user_id, old_email, new_email);
    });
}

module.exports = routes;
