const bcrypt = require('bcrypt');
const config = require('../config');
const const_providers = require('../helpers/const/const_providers');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const date_add_hours = require('@vbarbarosh/node-helpers/src/date_add_hours');
const db = require('../../db');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const http_get_json = require('@vbarbarosh/node-helpers/src/http_get_json');
const http_post_urlencoded = require('@vbarbarosh/node-helpers/src/http_post_urlencoded');
const promisify = require('../helpers/promisify');
const random_hex = require('@vbarbarosh/node-helpers/src/random_hex');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const routes = [
    {req: 'GET /auth/status', fn: status_get},
    {req: 'GET /auth/sign-in', fn: sign_in_get},
    {req: 'GET /auth/sign-out', fn: sign_out_get},
    {req: 'GET /auth/sign-up', fn: sign_up_get},
    {req: 'GET /auth/forgot-password', fn: forgot_password_get},
    {req: 'GET /auth/reset-password', fn: reset_password_get},
    {req: 'GET /auth/change-password', fn: change_password_get},
    {req: 'GET /auth/google', fn: google_get},
    {req: 'GET /auth/google/callback', fn: google_callback_get},
    {req: 'POST /auth/sign-in', fn: sign_in_post},
    {req: 'POST /auth/sign-out', fn: sign_out_post},
    {req: 'POST /auth/sign-up', fn: sign_up_post},
    {req: 'POST /auth/forgot-password', fn: forgot_password_post},
    {req: 'POST /auth/reset-password', fn: reset_password_post},
    {req: 'POST /auth/change-password', fn: change_password_post},
];

// GET /auth/status
async function status_get(req, res)
{
    let user = null;
    if (req.session.user_id) {
        user = await db('users').where({id: req.session.user_id}).first();
    }

    const error = req.session.error ?? null;
    delete req.session.error;

    if (!user) {
        res.send({error, authenticated: false});
    }
    else {
        res.send({
            error,
            authenticated: true,
            username: user.username,
            email: user.email,
            email_verified: user.email_verified,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
        });
    }
}

// GET /auth/sign-in
async function sign_in_get(req, res)
{
    res.sendFile(fs_path_resolve(__dirname, '../static/sign-in.html'));
}

// POST /auth/sign-in
async function sign_in_post(req, res)
{
    const {username, password} = req.body;

    if (!username || !password) {
        throw new Error('Missing fields');
    }

    const user = await db('users').where({username}).first();
    if (!user) {
        throw new Error('Invalid username or password');
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
        throw new Error('Invalid username or password');
    }

    await promisify(v => req.session.regenerate(v));
    req.session.user_id = user.id;
    await promisify(v => req.session.save(v));
    redirect(req, res);
}

// GET /auth/sign-out
async function sign_out_get(req, res)
{
    res.sendFile(fs_path_resolve(__dirname, '../static/sign-out.html'));
}

// POST /auth/sign-out
async function sign_out_post(req, res)
{
    await promisify(v => req.session.destroy(v));
    redirect(req, res, '/auth/sign-in');
}

// GET /auth/sign-up
async function sign_up_get(req, res)
{
    res.sendFile(fs_path_resolve(__dirname, '../static/sign-up.html'));
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

    try {
        const password_hash = await bcrypt.hash(password, config.password_rounds);
        const now = db.fn.now();
        const tmp = await db('users').insert({username, password_hash, created_at: now, updated_at: now});
        const user_id = tmp[0];
        await promisify(v => req.session.regenerate(v));
        req.session.user_id = user_id;
        await promisify(v => req.session.save(v));
        redirect(req, res);
    }
    catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.code === 'SQLITE_CONSTRAINT') {
            throw new Error('Username already exists')
        }
        throw error;
    }
}

// GET /auth/forgot-password
async function forgot_password_get(req, res)
{
    if (req.session.user_id) {
        // If a user is already authenticated, the forgot-password page probably shouldn't be used.
        redirect(req, res);
        return;
    }

    res.sendFile(fs_path_resolve(__dirname, '../static/forgot-password.html'));
}

// POST /auth/forgot-password
async function forgot_password_post(req, res)
{
    const {email} = req.body;
    if (!email) {
        throw new Error('Missing email');
    }

    const user = await db('users').where({email}).first();
    if (user) {
        const token = random_hex();
        const now = db.fn.now();

        await db('password_reset_tokens').insert({
            user_id: user.id,
            token_hash: crypto_hash_sha256(token),
            created_at: now,
            updated_at: now,
            expires_at: date_add_hours(new Date(), 1),
        });

        const reset_link = urlmod(`${config.base_url}/auth/reset-password`, {token});
        console.log(`Reset link: ${reset_link}`);
    }

    // never reveal whether email exists
    redirect(req, res, '/auth/sign-in');
}

// GET /auth/reset-password
async function reset_password_get(req, res)
{
    const {token} = req.query;
    if (!token) {
        throw new Error('Missing token');
    }

    const token_hash = crypto_hash_sha256(token);
    const reset = await db('password_reset_tokens').where({token_hash}).first();
    if (!reset || reset.used_at || new Date(reset.expires_at) < new Date()) {
        throw new Error('Invalid reset token');
    }

    res.sendFile(fs_path_resolve(__dirname, '../static/reset-password.html'));
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
        const now = trx.fn.now();
        await trx('users').where({id: reset.user_id}).update({password_hash, updated_at: now});
        await trx('password_reset_tokens').where({id: reset.id}).update({used_at: now, updated_at: now});
    });

    redirect(req, res, '/auth/sign-in');
}

// GET /auth/change-password
async function change_password_get(req, res)
{
    if (!req.session.user_id) {
        return redirect(req, res, '/auth/sign-in');
    }

    res.sendFile(fs_path_resolve(__dirname, '../static/change-password.html'));
}

// POST /auth/change-password
async function change_password_post(req, res)
{
    if (!req.session.user_id) {
        throw new Error('Authentication required');
    }

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
    const now = db.fn.now();
    await db('users').where({id: user.id}).update({password_hash, updated_at: now});

    await promisify(v => req.session.regenerate(v));
    req.session.user_id = user.id;
    await promisify(v => req.session.save(v));

    redirect(req, res);
}

// GET /auth/google
async function google_get(req, res)
{
    const state = random_hex();
    req.session.oauth_state = state;
    await promisify(v => req.session.save(v));

    res.redirect(urlmod('https://accounts.google.com/o/oauth2/v2/auth', {
        client_id: config.google_client_id,
        redirect_uri: config.google_redirect_url,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
        state,
    }));
}

// GET /auth/google/callback
async function google_callback_get(req, res)
{
    const {code, state} = req.query;
    const expected_state = req.session.oauth_state;
    delete req.session.oauth_state;

    if (!code) {
        throw new Error('Missing OAuth code');
    }
    if (!state || state !== expected_state) {
        throw new Error('Invalid OAuth state');
    }

    const token = await http_post_urlencoded('https://oauth2.googleapis.com/token', {
        code,
        client_id: config.google_client_id,
        client_secret: config.google_client_secret,
        redirect_uri: config.google_redirect_url,
        grant_type: 'authorization_code',
    });
    console.log(token);

    const userinfo = await http_get_json('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {Authorization: `Bearer ${token.access_token}`},
    });
    console.log(userinfo);

    const provider = const_providers.google;
    const provider_user_id = userinfo.sub;

    let user_id;
    const user_identity = await db('user_identities').where({provider, provider_user_id}).first();
    if (user_identity) {
        user_id = user_identity.user_id;
    }
    else {
        const username = null;
        const password_hash = await bcrypt.hash(random_hex(), config.password_rounds);
        await db.transaction(async function (trx) {
            const now = trx.fn.now();
            const tmp = await trx('users').insert({
                username,
                password_hash,
                email: userinfo.email,
                email_verified: userinfo.email_verified,
                display_name: userinfo.name,
                avatar_url: userinfo.picture,
                created_at: now,
                updated_at: now,
            });
            console.log(tmp);
            user_id = tmp[0];
            await trx('user_identities').insert({user_id, provider, provider_user_id, created_at: now});
        });
    }

    await promisify(v => req.session.regenerate(v));
    req.session.user_id = user_id;
    await promisify(v => req.session.save(v));
    redirect(req, res);
}

function redirect(req, res, default_url = '/')
{
    if (typeof req.query.return === 'string' && req.query.return.startsWith('/')) {
        res.redirect(req.query.return);
    }
    else {
        res.redirect(default_url);
    }
}

module.exports = routes;
