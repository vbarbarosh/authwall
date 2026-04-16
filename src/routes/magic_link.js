const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const authorize_email = require('../helpers/authorize_email');
const bcrypt = require('bcrypt');
const complete_magic_link_request = require('../actions/complete_magic_link_request');
const complete_sign_in = require('../actions/complete_sign_in');
const complete_sign_up = require('../actions/complete_sign_up');
const config = require('../../config');
const const_user_identity = require('../helpers/const/const_user_identity');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const make_rate_limit_middleware = require('../helpers/middleware/rate_limit_middleware');
const normalize_email = require('../helpers/normalize/normalize_email');
const random_code = require('../helpers/random/random_code');
const random_hex = require('@vbarbarosh/node-helpers/src/random_hex');
const random_uid_user_identity = require('../helpers/random/random_uid_user_identity');
const users_create = require('../helpers/models/users_create');

const SECOND = 1000;
const MINUTE = 60*SECOND;
const MAX_ATTEMPTS = 3;

const magic_link_limiter = make_rate_limit_middleware(5, 60*MINUTE);

const routes = [
    {req: `GET ${config.pages.magic_link_confirm}`, fn: magic_link_confirm_get},
    {prepend: [csrf_middleware], routes: [
        {req: 'POST /auth/magic-link/request', prepend: [magic_link_limiter], fn: magic_link_request_post},
        {req: 'POST /auth/magic-link/confirm', fn: magic_link_confirm_post},
    ]},
];

// POST /auth/magic-link/request
async function magic_link_request_post(req, res)
{
    if (!req.body.email) {
        throw new UserFriendlyError('Missing email');
    }

    const email = req.body.email;
    const email_normalized = normalize_email(email);
    if (!email) {
        throw new UserFriendlyError('Invalid email');
    }
    await authorize_email(email_normalized);

    // prevent spamming
    const magic_link = await db('magic_links').where({email_normalized}).orderBy('id', 'desc').first();
    if (magic_link && (Date.now() - new Date(magic_link.created_at).getTime()) < 60*SECOND) {
        throw new UserFriendlyError('Magic link already sent. Please wait.');
    }

    const code = random_code();
    const token = random_hex();

    const now = new Date();
    await db('magic_links').insert({
        email,
        email_normalized,
        code_hash: await bcrypt.hash(code, config.password_rounds),
        token_hash: crypto_hash_sha256(token),
        created_at: now,
        updated_at: now,
        expires_at: date_add_minutes(new Date(), 10),
    });

    await complete_magic_link_request(req, res, email, code, token);
}

// GET /auth/magic-link/confirm
async function magic_link_confirm_get(req, res)
{
    const {token} = req.query;
    if (!token) {
        throw new UserFriendlyError('Missing token');
    }

    const now = new Date();
    const magic_link = await db('magic_links')
        .whereNull('used_at')
        .where('token_hash', crypto_hash_sha256(token))
        .where('expires_at', '>', now)
        .first();
    if (!magic_link) {
        throw new UserFriendlyError('Invalid or expired magic link');
    }

    await db('magic_links').where({id: magic_link.id}).update({used_at: now, updated_at: now});

    const email = magic_link.email;
    const email_normalized = magic_link.email_normalized;
    await authorize_email(email_normalized);

    const ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first();
    if (ident) {
        const user = await db('users').where({id: ident.user_id}).first();
        await complete_sign_in(req, res, user);
    }
    else {
        const user = await users_create();
        await db('user_identities').insert({
            uid: random_uid_user_identity(),
            user_id: user.id,
            type: const_user_identity.email,
            value: email,
            value_normalized: email_normalized,
            created_at: now,
            updated_at: now,
            verified_at: now,
        });
        await complete_sign_up(req, res, user);
    }
}

// POST /auth/magic-link/confirm
async function magic_link_confirm_post(req, res)
{
    const {code} = req.body;
    if (!req.body.email || !code) {
        throw new UserFriendlyError('Missing fields');
    }

    const email = req.body.email;
    const email_normalized = normalize_email(email);
    if (!email_normalized) {
        throw new UserFriendlyError('Invalid email');
    }
    await authorize_email(email_normalized);

    const now = new Date();
    const magic_link = await db('magic_links')
        .where({email_normalized})
        .whereNull('used_at')
        .where('expires_at', '>', now)
        .orderBy('id', 'desc')
        .first();
    if (!magic_link) {
        throw new UserFriendlyError('Invalid or expired code');
    }
    if (magic_link.attempts >= MAX_ATTEMPTS) {
        throw new UserFriendlyError('Invalid or expired code');
    }

    await db('magic_links').where({id: magic_link.id}).update({attempts: magic_link.attempts + 1, updated_at: now});

    const ok = await bcrypt.compare(code, magic_link.code_hash);
    if (!ok) {
        throw new UserFriendlyError('Invalid or expired code');
    }

    await db('magic_links').where({id: magic_link.id}).update({used_at: now, updated_at: now});

    const ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first();
    if (ident) {
        const user = await db('users').where({id: ident.user_id}).first();
        await complete_sign_in(req, res, user);
    }
    else {
        const user = await users_create();
        await db('user_identities').insert({
            uid: random_uid_user_identity(),
            user_id: user.id,
            type: const_user_identity.email,
            value: email,
            value_normalized: email_normalized,
            created_at: now,
            updated_at: now,
            verified_at: now,
        });
        await complete_sign_up(req, res, user);
    }
}

module.exports = routes;
