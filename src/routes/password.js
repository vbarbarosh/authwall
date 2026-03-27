const auth_middleware = require('../helpers/middleware/auth_middleware');
const bcrypt = require('bcrypt');
const config = require('../../config');
const const_user_identity = require('../helpers/const/const_user_identity');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const normalize_email = require('../helpers/normalize/normalize_email');
const normalize_username = require('../helpers/normalize/normalize_username');
const random_hex = require('@vbarbarosh/node-helpers/src/random_hex');
const redirect = require('../helpers/redirect');
const replace_session = require('../helpers/replace_session');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const users_create = require('../helpers/models/users_create');

const routes = [
    // {req: 'GET /auth/sign-in', fn: sign_in_get},
    // {req: 'GET /auth/sign-up', fn: sign_up_get},
    // {req: 'GET /auth/forgot-password', fn: forgot_password_get},
    // {req: 'GET /auth/reset-password', fn: reset_password_get},
    {prepend: [csrf_middleware], routes: [
        {req: 'POST /auth/sign-in', fn: sign_in_post},
        {req: 'POST /auth/sign-up', fn: sign_up_post},
        {req: 'POST /auth/forgot-password', fn: forgot_password_post},
        {req: 'POST /auth/reset-password', fn: reset_password_post},
    ]},
    {prepend: [auth_middleware], routes: [
        // {req: 'GET /auth/change-password', fn: change_password_get},
        {prepend: [csrf_middleware], routes: [
            {req: 'POST /auth/change-password', fn: change_password_post},
        ]},
    ]},
];

// // GET /auth/sign-in
// async function sign_in_get(req, res)
// {
//     res.sendFile(fs_path_resolve(__dirname, '../static/sign-in.html'));
// }
//
// // GET /auth/sign-up
// async function sign_up_get(req, res)
// {
//     res.sendFile(fs_path_resolve(__dirname, '../static/sign-up.html'));
// }
//
// // GET /auth/forgot-password
// async function forgot_password_get(req, res)
// {
//     if (req.session.user_id) {
//         // If a user is already authenticated, the forgot-password page probably shouldn't be used.
//         redirect(req, res);
//         return;
//     }
//
//     res.sendFile(fs_path_resolve(__dirname, '../static/forgot-password.html'));
// }
//
// // GET /auth/reset-password
// async function reset_password_get(req, res)
// {
//     const {token} = req.query;
//     if (!token) {
//         throw new Error('Missing token');
//     }
//
//     const now = new Date();
//     const reset = await db('password_reset_tokens')
//         .whereNull('used_at')
//         .where({token_hash: crypto_hash_sha256(token)})
//         .where('expires_at', '>', now)
//         .first();
//     if (!reset) {
//         throw new Error('Invalid reset token');
//     }
//
//     res.sendFile(fs_path_resolve(__dirname, '../static/reset-password.html'));
// }
//
// // GET /auth/change-password
// async function change_password_get(req, res)
// {
//     if (!req.session.user_id) {
//         return redirect(req, res, '/auth/sign-in');
//     }
//
//     res.sendFile(fs_path_resolve(__dirname, '../static/change-password.html'));
// }

// POST /auth/sign-in
async function sign_in_post(req, res)
{
    const {username, password} = req.body;

    if (!username || !password) {
        throw new Error('Missing fields');
    }

    const username_normalized = normalize_username(username);
    if (!username_normalized) {
        throw new Error('Invalid username or password');
    }

    const ident = await db('user_identities').where({type: const_user_identity.username, value_normalized: username_normalized}).first();
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

    await replace_session(req, user);

    redirect(req, res);
}

// POST /auth/sign-up
async function sign_up_post(req, res)
{
    const {username, password, password_confirm} = req.body;

    if (!username || !password) {
        throw new Error('Missing fields');
    }

    if (password !== password_confirm) {
        throw new Error('Passwords do not match')
    }

    const username_normalized = normalize_username(username);
    if (!username_normalized) {
        throw new Error('Invalid username')
    }

    try {
        const now = new Date();
        let user;
        await db.transaction(async function (trx) {
            user = await users_create({trx, password});
            await trx('user_identities').insert({
                user_id: user.id,
                type: const_user_identity.username,
                value: username,
                value_normalized: username_normalized,
                created_at: now,
                updated_at: now,
                verified_at: now,
            });
        });

        await replace_session(req, user);

        redirect(req, res);
    }
    catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.code === 'SQLITE_CONSTRAINT') {
            throw new Error('Username already exists')
        }
        throw error;
    }
}

// POST /auth/forgot-password
async function forgot_password_post(req, res)
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
        const reset_link = urlmod(`${config.public_url}/auth/reset-password`, {token});

        const now = new Date();
        await db('password_reset_tokens').insert({
            user_id: ident.user_id,
            token_hash: crypto_hash_sha256(token),
            created_at: now,
            updated_at: now,
            expires_at: date_add_minutes(new Date(), 10),
        });

        console.log(`Reset link: ${reset_link}`);
    }

    // never reveal whether email exists
    redirect(req, res, '/auth/sign-in');
}

// POST /auth/reset-password
async function reset_password_post(req, res)
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

    redirect(req, res, '/auth/sign-in');
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

    await replace_session(req, user);

    redirect(req, res);
}

module.exports = routes;
