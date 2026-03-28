const auth_middleware = require('../helpers/middleware/auth_middleware');
const bcrypt = require('bcrypt');
const complete_password_change = require('../actions/complete_password_change');
const complete_password_reset_confirm = require('../actions/complete_password_reset_confirm');
const complete_password_reset_request = require('../actions/complete_password_reset_request');
const complete_sign_in = require('../actions/complete_sign_in');
const complete_sign_up = require('../actions/complete_sign_up');
const config = require('../../config');
const const_user_identity = require('../helpers/const/const_user_identity');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const normalize_email = require('../helpers/normalize/normalize_email');
const normalize_username = require('../helpers/normalize/normalize_username');
const random_hex = require('@vbarbarosh/node-helpers/src/random_hex');
const redirect = require('../helpers/redirect');
const users_create = require('../helpers/models/users_create');

const routes = [
    {prepend: [csrf_middleware], routes: [
        {req: 'POST /auth/sign-in', fn: sign_in_post},
        {req: 'POST /auth/sign-up', fn: sign_up_post},
        {req: 'POST /auth/password-reset/request', fn: password_reset_request_post},
        {req: 'POST /auth/password-reset/confirm', fn: password_reset_confirm_post},
    ]},
    {prepend: [auth_middleware], routes: [
        // {req: 'GET /auth/change-password', fn: change_password_get},
        {prepend: [csrf_middleware], routes: [
            {req: 'POST /auth/change-password', fn: change_password_post},
        ]},
    ]},
];

// POST /auth/sign-in
async function sign_in_post(req, res)
{
    const {username, password} = req.body;

    if (!username || !password) {
        throw new Error('Missing fields');
    }

    const is_email = username.includes('@');
    let ident;
    if (is_email) {
        const email_normalized = normalize_email(username);
        if (!email_normalized) {
            throw new Error('Invalid username or password');
        }
        ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first();
    }
    else {
        const username_normalized = normalize_username(username);
        if (!username_normalized) {
            throw new Error('Invalid username or password');
        }
        ident = await db('user_identities').where({type: const_user_identity.username, value_normalized: username_normalized}).first();
    }

    if (!ident) {
        throw new Error('Invalid username or password');
    }

    const user = await db('users').where({id: ident.user_id}).first();
    const password_hash = user?.password_hash || '$2b$10$invalidinvalidinvalidinvalidinv';

    // Attackers can detect if username exists by timing
    const ok = await bcrypt.compare(password, password_hash);
    if (!user || !ok) {
        throw new Error('Invalid username or password');
    }

    await complete_sign_in(req, res, user);
}

// POST /auth/sign-up
async function sign_up_post(req, res)
{
    const {email, username, password, password_confirm} = req.body;

    if ((!email && !username) || !password) {
        throw new Error('Missing fields');
    }

    if (password !== password_confirm) {
        throw new Error('Passwords do not match')
    }

    const email_normalized = normalize_email(email);
    const username_normalized = normalize_username(username);

    if (email && !email_normalized) {
        throw new Error('Invalid email');
    }
    if (username && !username_normalized) {
        throw new Error('Invalid username');
    }

    if (email_normalized) {
        if (await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first()) {
            throw new Error('Email already exists');
        }
    }
    if (username_normalized) {
        if (await db('user_identities').where({type: const_user_identity.username, value_normalized: username_normalized}).first()) {
            throw new Error('Username already exists');
        }
    }

    try {
        const now = new Date();
        let user;
        await db.transaction(async function (trx) {
            user = await users_create({trx, password});
            const insert = [];
            if (email_normalized) {
                insert.push({
                    user_id: user.id,
                    type: const_user_identity.email,
                    value: email,
                    value_normalized: email_normalized,
                    created_at: now,
                    updated_at: now,
                    verified_at: null,
                });
            }
            if (username_normalized) {
                insert.push({
                    user_id: user.id,
                    type: const_user_identity.username,
                    value: username,
                    value_normalized: username_normalized,
                    created_at: now,
                    updated_at: now,
                    verified_at: now,
                });
            }
            await trx('user_identities').insert(insert);
        });

        await complete_sign_up(req, res, user);
    }
    catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.code === 'SQLITE_CONSTRAINT') {
            throw new Error('Identity already exists')
        }
        throw error;
    }
}

// POST /auth/password-reset/request
async function password_reset_request_post(req, res)
{
    if (!req.body.email) {
        throw new Error('Missing email');
    }
    const email_normalized = normalize_email(req.body.email);
    if (!email_normalized) {
        throw new Error('Invalid email');
    }

    const ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first();
    if (ident) {
        const token = random_hex();

        const now = new Date();
        await db('password_reset_tokens').insert({
            user_id: ident.user_id,
            token_hash: crypto_hash_sha256(token),
            created_at: now,
            updated_at: now,
            expires_at: date_add_minutes(new Date(), 10),
        });

        await complete_password_reset_request(req, res, ident.user_id, ident.value, token);
        return;
    }

    // Never reveal whether email exists
    redirect(req, res, config.pages.password_reset_notice);
}

// POST /auth/password-reset/confirm
async function password_reset_confirm_post(req, res)
{
    const {token, password, password_confirm} = req.body;

    if (!token || !password || !password_confirm) {
        throw new Error('Missing fields');
    }

    if (password !== password_confirm) {
        throw new Error('Passwords do not match');
    }

    const token_hash = crypto_hash_sha256(token);
    const reset = await db('password_reset_tokens').where({token_hash}).first();
    if (!reset) {
        throw new Error('Invalid reset token');
    }
    if (reset.used_at) {
        throw new Error('Reset token already used');
    }
    if (new Date(reset.expires_at) < new Date()) {
        throw new Error('Reset token expired');
    }

    const password_hash = await bcrypt.hash(password, config.password_rounds);
    await db.transaction(async function (trx) {
        const now = new Date();
        await trx('users').where({id: reset.user_id}).update({password_hash, updated_at: now});
        await trx('password_reset_tokens').where({id: reset.id}).update({used_at: now, updated_at: now});
    });

    await complete_password_reset_confirm(req, res, reset.user_id);
}

// POST /auth/change-password
async function change_password_post(req, res)
{
    const {current_password, password, password_confirm} = req.body;

    if (!current_password || !password || !password_confirm) {
        throw new Error('Missing fields');
    }

    if (password !== password_confirm) {
        throw new Error('Passwords do not match');
    }

    const user = await db('users').where({id: req.session.user_id}).first();
    if (!user) {
        throw new Error('User not found');
    }

    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) {
        throw new Error('Current password is incorrect');
    }

    const password_hash = await bcrypt.hash(password, config.password_rounds);
    const now = new Date();
    await db('users').where({id: user.id}).update({password_hash, updated_at: now});

    await complete_password_change(req, res, user.id);
}

module.exports = routes;
