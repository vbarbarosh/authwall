const bcrypt = require('bcrypt');
const config = require('../../config');
const const_oauth_intent = require('../helpers/const/const_oauth_intent');
const const_user_identity = require('../helpers/const/const_user_identity');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const fs_mkdirp = require('@vbarbarosh/node-helpers/src/fs_mkdirp');
const fs_path_dirname = require('@vbarbarosh/node-helpers/src/fs_path_dirname');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const fs_rm = require('@vbarbarosh/node-helpers/src/fs_rm');
const http_get_json = require('@vbarbarosh/node-helpers/src/http_get_json');
const http_post_urlencoded = require('@vbarbarosh/node-helpers/src/http_post_urlencoded');
const multer = require('multer');
const normalize_email = require('../helpers/normalize/normalize_email');
const normalize_ip = require('../helpers/normalize/normalize_ip');
const normalize_username = require('../helpers/normalize/normalize_username');
const oauth_intent_from_state = require('../helpers/oauth_intent_from_state');
const oauth_state_from_intent = require('../helpers/oauth_state_from_intent');
const promisify = require('../helpers/promisify');
const random_base62 = require('../helpers/random/random_base62');
const random_code = require('../helpers/random/random_code');
const random_hex = require('@vbarbarosh/node-helpers/src/random_hex');
const random_slug = require('../helpers/random/random_slug');
const random_uid_user = require('../helpers/random/random_uid_user');
const sharp = require('sharp');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const SECOND = 1000;

const upload_avatar = multer({
    dest: fs_path_resolve(__dirname, '../../data/temp-uploads'),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: function (req, file, callback) {
        if (!file.mimetype.startsWith('image/')) {
            callback(new Error('Invalid file type'));
            return;
        }
        callback(null, true);
    }
});

const routes = [
    {req: 'GET /auth/status', fn: status_get},
    {req: 'GET /auth/google', fn: google_get},
    {req: 'GET /auth/google/callback', fn: google_callback_get},
    {req: 'GET /auth/sign-in', fn: sign_in_get},
    {req: 'GET /auth/sign-up', fn: sign_up_get},
    {req: 'GET /auth/forgot-password', fn: forgot_password_get},
    {req: 'GET /auth/reset-password', fn: reset_password_get},
    {req: 'GET /auth/magic-link', fn: magic_link_get},
    {req: 'GET /auth/magic-link-sent', fn: magic_link_sent_get},
    {req: 'GET /auth/magic-link/callback', fn: magic_link_callback_get},
    {prepend: [csrf_middleware], routes: [
        {req: 'POST /auth/sign-in', fn: sign_in_post},
        {req: 'POST /auth/sign-up', fn: sign_up_post},
        {req: 'POST /auth/forgot-password', fn: forgot_password_post},
        {req: 'POST /auth/reset-password', fn: reset_password_post},
        {req: 'POST /auth/magic-link', fn: magic_link_post},
        {req: 'POST /auth/magic-link-sent', fn: magic_link_sent_post},
    ]},
    {prepend: [auth_middleware], routes: [
        {req: 'GET /auth/profile', fn: profile_get},
        {req: 'GET /auth/sessions', fn: sessions_get},
        {req: 'GET /auth/sign-out', fn: sign_out_get},
        {req: 'GET /auth/change-password', fn: change_password_get},
        {req: 'POST /auth/profile', fn: [upload_avatar.single('avatar'), csrf_middleware, profile_post]},
        {prepend: [csrf_middleware], routes: [
            {req: 'POST /auth/sessions/revoke', fn: sessions_revoke_post},
            {req: 'POST /auth/sessions/revoke-all', fn: sessions_revoke_all_post},
            {req: 'POST /auth/sign-out', fn: sign_out_post},
            {req: 'POST /auth/change-password', fn: change_password_post},
        ]},
    ]},
];

async function auth_middleware(req, res, next)
{
    if (!req.session.user_id) {
        next(new Error('Authentication required'));
    }
    next();
}

async function csrf_middleware(req, res, next)
{
    if (req.body._csrf !== req.session.csrf_token) {
        next(new Error('[403] Invalid CSRF Token'));
    }
    else {
        next();
    }
}

// GET /auth/status
async function status_get(req, res)
{
    console.log('GET /auth/status | 1', req.session);

    let user = null;
    if (req.session.user_id) {
        user = await db('users').where({id: req.session.user_id}).first();
    }
    console.log('GET /auth/status | 2', {user});

    const error = req.session.error ?? null;
    delete req.session.error;

    if (!user) {
        res.send({
            error,
            authenticated: false,
            csrf_token: req.session.csrf_token,
            debug: {
                users: await db('users'),
                sessions: await db('sessions'),
            },
        });
    }
    else {
        res.send({
            error,
            authenticated: true,
            csrf_token: req.session.csrf_token,
            display_name: user.display_name,
            avatar_url: user.avatar_url, // ?? 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYOiCQT7RdsZ50X6uSIX3IVaqwvfGiDD2EBQ&s',
            providers: await db('user_identities').where('user_id', req.session.user_id),
            current_session_uid: req.sessionID,
            sessions: await db('sessions').where('user_id', req.session.user_id),
            debug: {
                users: await db('users'),
                sessions: await db('sessions'),
            },
        });
    }
}

// GET /auth/profile
async function profile_get(req, res)
{
    res.sendFile(fs_path_resolve(__dirname, '../static/profile.html'));
}

// POST /auth/profile
async function profile_post(req, res)
{
    // const {current_password, password, password_confirm} = req.body;
    // if (!current_password || !password || !password_confirm) {
    //     throw new Error('Missing fields');
    // }
    //
    // if (password !== password_confirm) {
    //     throw new Error('Passwords do not match');
    // }

    const update = {};

    if ('display_name' in req.body) {
        update.display_name = String(req.body.display_name).trim() || null;
    }

    const user = await db('users').where({id: req.session.user_id}).first();
    if (!user) {
        throw new Error('User not found');
    }

    if (req.file) {
        const avatar_path = fs_path_resolve(__dirname, `../../data/uploads/${user.slug}/avatar.webp`);
        await fs_mkdirp(fs_path_dirname(avatar_path));
        await sharp(req.file.path).resize(256, 256, {fit: 'cover'}).webp({quality: 90}).toFile(avatar_path);
        await fs_rm(req.file.path)
        update.avatar_url = `${config.public_url}/auth/uploads/${user.slug}/avatar.webp`;
    }

    // const ok = await bcrypt.compare(current_password, user.password_hash);
    // if (!ok) {
    //     throw new Error('Current password is incorrect');
    // }
    // const password_hash = await bcrypt.hash(password, config.password_rounds);

    const now = new Date();
    await db('users').where({id: user.id}).update({...update, updated_at: now});

    // refresh session (important after credential change)
    await replace_session(req, user);

    redirect(req, res, '/auth/profile');
}

// GET /auth/sessions
async function sessions_get(req, res)
{
    res.sendFile(fs_path_resolve(__dirname, '../static/sessions.html'));
}

// POST /auth/sessions/revoke
async function sessions_revoke_post(req, res)
{
    const {uid} = req.body;
    if (!uid) {
        throw new Error('Missing session uid');
    }

    // Prevent deleting current session
    if (uid === req.sessionID) {
        throw new Error('Cannot revoke current session');
    }

    await db('sessions').where({uid, user_id: req.session.user_id}).delete();

    redirect(req, res, '/auth/sessions');
}

// POST /auth/sessions/revoke-all
async function sessions_revoke_all_post(req, res)
{
    await db('sessions')
        .where({user_id: req.session.user_id})
        .whereNot({uid: req.sessionID})
        .delete();

    redirect(req, res, '/auth/sessions');
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

    const username_normalized = normalize_username(username);
    if (!username_normalized) {
        throw new Error('Invalid username')
    }

    try {
        const now = new Date();
        let user_id;
        await db.transaction(async function (trx) {
            [user_id] = await trx('users').insert({
                uid: random_uid_user(),
                slug: random_slug(),
                password_hash: await bcrypt.hash(password, config.password_rounds),
                created_at: now,
                updated_at: now,
            });
            await trx('user_identities').insert({
                user_id,
                type: const_user_identity.username,
                value: username,
                value_normalized: username_normalized,
                created_at: now,
                updated_at: now,
                verified_at: now,
            });
        });
        const user = await db('users').where({id: user_id}).first();

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

// GET /auth/reset-password
async function reset_password_get(req, res)
{
    const {token} = req.query;
    if (!token) {
        throw new Error('Missing token');
    }

    const now = new Date();
    const reset = await db('password_reset_tokens')
        .whereNull('used_at')
        .where({token_hash: crypto_hash_sha256(token)})
        .where('expires_at', '>', now)
        .first();
    if (!reset) {
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
        const now = new Date();
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

// GET /auth/google
async function google_get(req, res)
{
    const intent = req.query.connect ? const_oauth_intent.connect : const_oauth_intent.login;
    const state = oauth_state_from_intent(intent);

    req.session.oauth_state = state;
    await save_session(req);

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

    // Prevent accidentally losing state on invalid requests
    // delete req.session.oauth_state;

    if (!code) {
        throw new Error('Missing OAuth code');
    }
    if (!state || state !== expected_state) {
        throw new Error('Invalid OAuth state');
    }

    delete req.session.oauth_state;

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

    const ident = await db('user_identities').where({
        type: const_user_identity.oauth_google,
        value_normalized: userinfo.sub,
    }).first();

    const oauth_intent = oauth_intent_from_state(state);

    // Connect account flow
    if (oauth_intent === const_oauth_intent.connect) {

        if (!req.session.user_id) {
            throw new Error('Authentication required');
        }

        if (ident) {
            if (ident.user_id !== req.session.user_id) {
                throw new Error('Google account already linked to another user');
            }
            // already connected
            return redirect(req, res, '/auth/profile');
        }

        const now = new Date();
        await db('user_identities').insert({
            user_id: req.session.user_id,
            type: const_user_identity.oauth_google,
            value: userinfo.sub,
            value_normalized: userinfo.sub,
            created_at: now,
            updated_at: now,
        });

        redirect(req, res, '/auth/profile');
        return;
    }

    if (oauth_intent !== const_oauth_intent.login) {
        throw new Error(`Invalid OAuth intent: ${oauth_intent}`);
    }

    let user_id;

    // Login flow
    if (ident) {
        user_id = ident.user_id;
    }
    else {
        await db.transaction(async function (trx) {
            const now = new Date();
            [user_id] = await trx('users').insert({
                uid: random_uid_user(),
                slug: random_slug(),
                display_name: userinfo.name,
                avatar_url: userinfo.picture,
                created_at: now,
                updated_at: now,
            });
            await trx('user_identities').insert({
                user_id,
                type: const_user_identity.oauth_google,
                value: null,
                value_normalized: userinfo.sub,
                created_at: now,
                updated_at: now,
                verified_at: now,
            });
            if (userinfo.email_verified) {
                const email = userinfo.email;
                const email_normalized = normalize_email(userinfo.email);
                if (email_normalized) {
                    await trx('user_identities').insert({
                        user_id,
                        type: const_user_identity.email,
                        value: email,
                        value_normalized: email_normalized,
                        created_at: now,
                        updated_at: now,
                        verified_at: now,
                    }).onConflict(['type', 'value_normalized']).ignore();
                }
            }
        });
    }

    const user = await db('users').where({id: user_id}).first();
    await replace_session(req, user);

    redirect(req, res);
}

// GET /auth/magic-link
async function magic_link_get(req, res)
{
    res.sendFile(fs_path_resolve(__dirname, '../static/magic-link.html'));
}

// POST /auth/magic-link
async function magic_link_post(req, res)
{
    if (!req.body.email) {
        throw new Error('Missing email');
    }
    const email = normalize_email(req.body.email);
    if (!email) {
        throw new Error('Invalid email');
    }

    // prevent spamming
    const magic_link = await db('magic_links').where({email}).orderBy('id', 'desc').first();
    if (magic_link && (Date.now() - new Date(magic_link.created_at).getTime()) < 60*SECOND) {
        throw new Error('Magic link already sent. Please wait.');
    }

    const code = random_code();
    const token = random_hex();
    const link = urlmod(`${config.public_url}/auth/magic-link/callback`, {token});

    const now = new Date();
    await db('magic_links').insert({
        email,
        code_hash: await bcrypt.hash(code, config.password_rounds),
        token_hash: crypto_hash_sha256(token),
        created_at: now,
        updated_at: now,
        expires_at: date_add_minutes(new Date(), 10),
    });

    console.log(`Magic link for ${email}: [${code}] ${link}`);

    redirect(req, res, urlmod('/auth/magic-link-sent', {email}));
}

// GET /auth/magic-link-sent
async function magic_link_sent_get(req, res)
{
    res.sendFile(fs_path_resolve(__dirname, '../static/magic-link-sent.html'));
}

// POST /auth/magic-link-sent
async function magic_link_sent_post(req, res)
{
    const {code} = req.body;
    if (!req.body.email || !code) {
        throw new Error('Missing fields');
    }

    const email = req.body.email;
    const email_normalized = normalize_email(email);
    if (!email_normalized) {
        throw new Error('Invalid email');
    }

    const now = new Date();
    const magic_link = await db('magic_links')
        .where({email: email_normalized})
        .whereNull('used_at')
        .where('expires_at', '>', now)
        .orderBy('id', 'desc')
        .first();
    if (!magic_link) {
        throw new Error('Invalid or expired code');
    }
    const ok = await bcrypt.compare(code, magic_link.code_hash);
    if (!ok) {
        throw new Error('Invalid or expired code');
    }

    await db('magic_links').where({id: magic_link.id}).update({used_at: now, updated_at: now});

    let user_id;
    const ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first();
    if (ident) {
        user_id = ident.user_id;
    }
    else {
        [user_id] = await db('users').insert({
            uid: random_uid_user(),
            slug: random_slug(),
            created_at: now,
            updated_at: now,
        });
        await db('user_identities').insert({
            user_id,
            type: const_user_identity.email,
            value: email,
            value_normalized: email_normalized,
            created_at: now,
            updated_at: now,
            verified_at: now,
        });
    }

    const user = await db('users').where({id: user_id}).first();
    await replace_session(req, user);

    redirect(req, res);
}

// GET /auth/magic-link/callback
async function magic_link_callback_get(req, res)
{
    const {token} = req.query;
    if (!token) {
        throw new Error('Missing token');
    }

    const now = new Date();
    const magic_link = await db('magic_links')
        .whereNull('used_at')
        .where('token_hash', crypto_hash_sha256(token))
        .where('expires_at', '>', now)
        .first();
    if (!magic_link) {
        throw new Error('Invalid or expired magic link');
    }

    await db('magic_links').where({id: magic_link.id}).update({used_at: now, updated_at: now});

    const email = magic_link.email;
    const email_normalized = normalize_email(magic_link.email);

    let user_id;
    const ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first();
    if (ident) {
        user_id = ident.user_id;
    }
    else {
        const [user_id] = await db('users').insert({
            uid: random_uid_user(),
            slug: random_slug(),
            created_at: now,
            updated_at: now,
        });
        await db('user_identities').insert({
            user_id,
            type: const_user_identity.email,
            value: email,
            value_normalized: email_normalized,
            created_at: now,
            updated_at: now,
            verified_at: now,
        });
    }

    const user = await db('users').where({id: user_id}).first();
    await replace_session(req, user);

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

async function save_session(req)
{
    await promisify(v => req.session.save(v));
}

async function replace_session(req, user)
{
    await promisify(v => req.session.regenerate(v));
    req.session.user_id = user.id;
    req.session.user_uid = user.uid;
    req.session.ip = normalize_ip(req.ip);
    req.session.user_agent = req.headers['user-agent'] ?? 'n/a';
    req.session.csrf_token = random_base62();
    await promisify(v => req.session.save(v));
}

module.exports = routes;
