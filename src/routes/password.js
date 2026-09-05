const EmailNotAuthorized = require('../helpers/errors/EmailNotAuthorized');
const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const authorize_email = require('../helpers/authorize_email');
const bcrypt = require('bcrypt');
const complete_password_change = require('../actions/complete_password_change');
const complete_password_reset_confirm = require('../actions/complete_password_reset_confirm');
const complete_password_reset_request = require('../actions/complete_password_reset_request');
const complete_sign_in = require('../actions/complete_sign_in');
const complete_sign_up = require('../actions/complete_sign_up');
const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_auth_event_status = require('../helpers/const/const_auth_event_status');
const const_user_identity = require('../helpers/const/const_user_identity');
const create_email_verify_token = require('../helpers/create_email_verify_token');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const has_email_access_rules = require('../helpers/has_email_access_rules');
const insert_auth_event = require('../helpers/insert_auth_event');
const make_rate_limit_middleware = require('../helpers/middleware/rate_limit_middleware');
const normalize_email = require('../helpers/normalize/normalize_email');
const normalize_username = require('../helpers/normalize/normalize_username');
const plural = require('@vbarbarosh/node-helpers/src/plural');
const random_base62 = require('../helpers/random/random_base62');
const random_hex = require('@vbarbarosh/node-helpers/src/random_hex');
const random_uid_user_identity = require('../helpers/random/random_uid_user_identity');
const redirect = require('../helpers/redirect');
const users_create = require('../helpers/models/users_create');

const SECOND = 1000;
const MINUTE = 60*SECOND;

let dummy_hash = null;

const sign_in_limiter = make_rate_limit_middleware(10, 15*MINUTE);
const sign_up_limiter = make_rate_limit_middleware(5, 60*MINUTE);
const password_reset_limiter = make_rate_limit_middleware(5, 60*MINUTE);

const routes = [
    {prepend: [csrf_middleware], routes: [
        {req: 'POST /auth/sign-in', prepend: [sign_in_limiter], fn: sign_in_post},
        {req: 'POST /auth/sign-up', prepend: [sign_up_limiter], fn: sign_up_post},
        {req: 'POST /auth/password-reset/request', prepend: [password_reset_limiter], fn: password_reset_request_post},
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
        throw new UserFriendlyError('Missing fields');
    }

    const is_email = username.includes('@');
    const ident_unsafe = {
        type: is_email ? const_user_identity.email : const_user_identity.username,
        value: username,
        value_normalized: null,
    };
    let ident;
    if (is_email) {
        const email_normalized = normalize_email(username);
        ident_unsafe.value_normalized = email_normalized;
        if (!config.flows.password.allow_email) {
            await insert_auth_event_sign_in_failure(req, ident_unsafe, {reason: 'flows_password_allow_email_disabled'});
            throw new UserFriendlyError('Invalid username or password');
        }
        if (!email_normalized) {
            await insert_auth_event_sign_in_failure(req, ident_unsafe, {reason: 'invalid_email'});
            throw new UserFriendlyError('Invalid username or password');
        }
        await authorize_email(email_normalized);
        ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first();
    }
    else {
        const username_normalized = normalize_username(username);
        ident_unsafe.value_normalized = username_normalized;
        if (!config.flows.password.allow_username) {
            await insert_auth_event_sign_in_failure(req, ident_unsafe, {reason: 'flows_password_allow_username_disabled'});
            throw new UserFriendlyError('Invalid username or password');
        }
        if (!username_normalized) {
            await insert_auth_event_sign_in_failure(req, ident_unsafe, {reason: 'invalid_username'});
            throw new UserFriendlyError('Invalid username or password');
        }
        ident = await db('user_identities').where({type: const_user_identity.username, value_normalized: username_normalized}).first();
    }

    const user = ident ? await db('users').where({id: ident.user_id}).first() : null;

    // Always run bcrypt to prevent timing-based username enumeration.
    // dummy_hash is computed once on first use with a random value so
    // an attacker cannot know which password would match it.
    if (!dummy_hash) {
        dummy_hash = await bcrypt.hash(random_base62(), config.bcrypt_rounds);
    }
    const password_hash = user?.password_hash ?? dummy_hash;
    const ok = await bcrypt.compare(password, password_hash);

    if (!user || !ok) {
        await insert_auth_event_sign_in_failure(req, ident ?? ident_unsafe, {reason: !user ? 'user_not_found' : 'invalid_password'});
        throw new UserFriendlyError('Invalid username or password');
    }

    if (!is_email && has_email_access_rules()) {
        // A username cannot establish eligibility under an email policy.
        // Match OAuth's policy: require at least one verified address and
        // authorize every verified address, so switching identifiers cannot
        // evade a deny rule. Do this only after the password is validated,
        // and answer exactly as a wrong password does — a refusal that named
        // the email policy would confirm the password to whoever guessed it.
        // The reason a real user was turned away lives in the auth event.
        const emails = await db('user_identities')
            .where({user_id: user.id, type: const_user_identity.email})
            .whereNotNull('verified_at');
        if (!emails.length) {
            await insert_auth_event_sign_in_failure(req, ident, {reason: 'no_verified_email'}, user);
            throw new UserFriendlyError('Invalid username or password');
        }
        for (const email of emails) {
            try {
                await authorize_email(email.value_normalized);
            }
            catch (error) {
                if (!(error instanceof EmailNotAuthorized)) {
                    throw error;
                }
                await insert_auth_event_sign_in_failure(req, ident, {reason: 'email_not_authorized', email: email.value_normalized, error: error.message}, user);
                throw new UserFriendlyError('Invalid username or password');
            }
        }
    }

    await complete_sign_in(req, res, user, ident);
}

// POST /auth/sign-up
async function sign_up_post(req, res)
{
    const {email, username, password, password_confirm} = req.body;

    if ((!email && !username) || !password) {
        throw new UserFriendlyError('Missing fields');
    }

    if (email && !config.flows.password.allow_email) {
        throw new UserFriendlyError('Email sign-up is disabled');
    }
    if (username && !config.flows.password.allow_username) {
        throw new UserFriendlyError('Username sign-up is disabled');
    }
    if (username && has_email_access_rules()) {
        // Even an accompanying email is unverified at registration. Keep
        // restricted registrations on the configured email/OAuth flows.
        throw new EmailNotAuthorized('Username sign-up is disabled when email access rules are configured');
    }

    if (password !== password_confirm) {
        throw new UserFriendlyError('Passwords do not match')
    }

    if (password.length < config.flows.password.min_password_length) {
        throw new UserFriendlyError(plural(config.flows.password.min_password_length, 'Password must be at least # character', 'Password must be at least # characters'));
    }

    const email_normalized = normalize_email(email);
    const username_normalized = normalize_username(username);

    if (email && !email_normalized) {
        throw new UserFriendlyError('Invalid email');
    }
    if (username && !username_normalized) {
        throw new UserFriendlyError('Invalid username');
    }

    if (email_normalized) {
        if (await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first()) {
            throw new UserFriendlyError('Email already exists');
        }
        await authorize_email(email_normalized);
    }
    if (username_normalized) {
        if (await db('user_identities').where({type: const_user_identity.username, value_normalized: username_normalized}).first()) {
            throw new UserFriendlyError('Username already exists');
        }
    }

    try {
        const now = new Date();
        let user;
        let ident;
        await db.transaction(async function () {
            user = await users_create({password});
            const insert = [];
            if (email_normalized) {
                insert.push({
                    uid: random_uid_user_identity(),
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
                    uid: random_uid_user_identity(),
                    user_id: user.id,
                    type: const_user_identity.username,
                    value: username,
                    value_normalized: username_normalized,
                    created_at: now,
                    updated_at: now,
                    verified_at: now,
                });
            }
            await db('user_identities').insert(insert);
            ident = await db('user_identities').where({uid: insert[0].uid}).first();
        });

        if (!email_normalized) {
            await complete_sign_up(req, res, user, null, ident, {method: 'signup_form', email, username});
        }
        else {
            const {token, code} = await create_email_verify_token(user.id, email_normalized, now);
            await complete_sign_up(req, res, user, token, ident, {method: 'signup_form', email, username}, code);
        }
    }
    catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.code === 'SQLITE_CONSTRAINT') {
            throw new UserFriendlyError('Identity already exists')
        }
        throw error;
    }
}

// POST /auth/password-reset/request
async function password_reset_request_post(req, res)
{
    if (!config.mailer.enabled) {
        throw new UserFriendlyError('Password reset is disabled');
    }

    const email = req.body.email;
    if (!email) {
        throw new UserFriendlyError('Missing email');
    }
    const email_normalized = normalize_email(email);
    if (!email_normalized) {
        throw new UserFriendlyError('Invalid email');
    }

    // Only a verified address can receive a reset link: anyone can register
    // anyone's e-mail unverified, and a reset delivered there would let the
    // real owner "recover" an account a stranger controls.
    const ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: email_normalized}).first();
    if (ident && ident.verified_at) {
        const token = random_hex();

        const now = new Date();
        const token_hash = crypto_hash_sha256(token).toString('base64url');
        await db('password_reset_tokens').insert({
            user_id: ident.user_id,
            token_hash,
            created_at: now,
            updated_at: now,
            expires_at: date_add_minutes(new Date(), 10),
        });

        await complete_password_reset_request(req, res, ident, token, token_hash);
        return;
    }

    // Never reveal whether email exists

    await insert_auth_event({
        req,
        ident: {
            type: const_user_identity.email,
            value: email,
            value_normalized: email_normalized,
        },
        event_type: const_auth_event.password_reset_requested,
        event_status: const_auth_event_status.noop,
        custom: {reason: ident ? 'email_not_verified' : 'email_not_found'},
    });

    redirect(req, res, config.pages.password_reset_notice);
}

// POST /auth/password-reset/confirm
async function password_reset_confirm_post(req, res)
{
    if (!config.mailer.enabled) {
        throw new UserFriendlyError('Password reset is disabled');
    }

    const {token, password, password_confirm} = req.body;

    if (!token || !password || !password_confirm) {
        throw new UserFriendlyError('Missing fields');
    }

    if (password !== password_confirm) {
        throw new UserFriendlyError('Passwords do not match');
    }

    if (password.length < config.flows.password.min_password_length) {
        throw new UserFriendlyError(plural(config.flows.password.min_password_length, 'Password must be at least # character', 'Password must be at least # characters'));
    }

    const token_hash = crypto_hash_sha256(token).toString('base64url');
    const reset = await db('password_reset_tokens').where({token_hash}).first();
    if (!reset) {
        throw new UserFriendlyError('Invalid reset token');
    }
    if (reset.used_at) {
        throw new UserFriendlyError('Reset token already used');
    }
    if (new Date(reset.expires_at) < new Date()) {
        throw new UserFriendlyError('Reset token expired');
    }

    const password_hash = await bcrypt.hash(password, config.bcrypt_rounds);
    await db.transaction(async function () {
        const now = new Date();
        await db('users').where({id: reset.user_id}).update({password_hash, updated_at: now});
        await db('password_reset_tokens').where({id: reset.id}).update({used_at: now, updated_at: now});
    });

    await complete_password_reset_confirm(req, res, reset.user_id, reset.token_hash);
}

// POST /auth/change-password
async function change_password_post(req, res)
{
    const {current_password, password, password_confirm} = req.body;

    const ident = await db('user_identities').where({user_id: req.session.user_id})
        .whereIn('type', [const_user_identity.email, const_user_identity.username])
        .whereNotNull('verified_at')
        .first();
    if (!ident) {
        throw new UserFriendlyError('Cannot set or change password without a verified email or username');
    }

    const user = await db('users').where({id: req.session.user_id}).first();
    if (!user) {
        throw new UserFriendlyError('User not found');
    }

    // A user who signed up through an OAuth provider has no password yet.
    // Setting the first one has nothing to verify against, so current_password
    // is not required — and must not be compared either, since
    // bcrypt.compare(x, null) throws rather than returning false.
    const has_password = user.password_hash !== null;

    if ((has_password && !current_password) || !password || !password_confirm) {
        throw new UserFriendlyError('Missing fields');
    }

    if (password !== password_confirm) {
        throw new UserFriendlyError('Passwords do not match');
    }

    if (password.length < config.flows.password.min_password_length) {
        throw new UserFriendlyError(plural(config.flows.password.min_password_length, 'Password must be at least # character', 'Password must be at least # characters'));
    }

    if (has_password && !await bcrypt.compare(current_password, user.password_hash)) {
        throw new UserFriendlyError('Current password is incorrect');
    }

    const password_hash = await bcrypt.hash(password, config.bcrypt_rounds);
    const now = new Date();
    await db('users').where({id: user.id}).update({password_hash, updated_at: now});

    await complete_password_change(req, res, user.id, {method: 'profile'});
}

async function insert_auth_event_sign_in_failure(req, ident, custom, user = null)
{
    await insert_auth_event({
        req,
        user,
        ident,
        event_type: const_auth_event.sign_in,
        event_status: const_auth_event_status.failure,
        custom: {method: 'sign_in_form', ...custom},
    });
}

module.exports = routes;
