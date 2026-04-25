const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const als = require('../helpers/als');
const assert_shape = require('../helpers/assert/assert_shape');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const authorize_oauth_verified_emails = require('../helpers/authorize_oauth_verified_emails');
const complete_sign_in = require('../actions/complete_sign_in');
const complete_sign_up = require('../actions/complete_sign_up');
const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_email = require('../helpers/const/const_email');
const const_oauth_intent = require('../helpers/const/const_oauth_intent');
const const_user_identity = require('../helpers/const/const_user_identity');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const db = require('../../db');
const format_date_pretty_24 = require('../helpers/format/format_date_pretty_24');
const get_user_email_and_name = require('../helpers/models/get_user_email_and_name');
const http_get_json = require('@vbarbarosh/node-helpers/src/http_get_json');
const http_post_json = require('../http/http_post_json');
const insert_auth_event = require('../helpers/insert_auth_event');
const oauth_intent_from_state = require('../helpers/oauth_intent_from_state');
const oauth_state_from_intent = require('../helpers/oauth_state_from_intent');
const random_uid_user_identity = require('../helpers/random/random_uid_user_identity');
const redirect = require('../helpers/redirect');
const save_session = require('../helpers/save_session');
const send_email_nothrow = require('../helpers/send_email_nothrow');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const users_create = require('../helpers/models/users_create');

const routes = [
    {req: 'GET /auth/github', fn: github_get},
    {req: 'GET /auth/github/callback', fn: github_callback_get},
    {prepend: [auth_middleware, csrf_middleware], routes: [
        {req: 'POST /auth/github/disconnect', fn: github_disconnect_post},
    ]},
];

// GET /auth/github
async function github_get(req, res)
{
    const intent = req.query.connect ? const_oauth_intent.connect : const_oauth_intent.login;
    const state = oauth_state_from_intent(intent);

    req.session.oauth_state = state;
    await save_session(req);

    res.redirect(urlmod('https://github.com/login/oauth/authorize', {
        client_id: config.flows.github.client_id,
        redirect_uri: config.flows.github.redirect_url,
        scope: 'user:email',
        prompt: 'select_account',
        state,
    }));
}

// GET /auth/github/callback
async function github_callback_get(req, res)
{
    const {code, state} = req.query;
    const expected_state = req.session.oauth_state;

    // Prevent accidentally losing state on invalid requests
    // delete req.session.oauth_state;

    if (!code) {
        throw new UserFriendlyError('Missing OAuth code');
    }
    if (!state || state !== expected_state) {
        throw new UserFriendlyError('Invalid OAuth state');
    }

    delete req.session.oauth_state;

    const tokens = await http_post_json('https://github.com/login/oauth/access_token', {
        code,
        client_id: config.flows.github.client_id,
        client_secret: config.flows.github.client_secret,
        redirect_uri: config.flows.github.redirect_url,
    });

    assert_shape(tokens, {
        access_token: String, // 'ghu_xxx',
        expires_in: Number, // 28800,
        refresh_token: String, // 'ghr_xxx',
        refresh_token_expires_in: Number, // 15811200,
        token_type: 'bearer',
        scope: String, // ''
    });

    const user_info = await http_get_json('https://api.github.com/user', {
        headers: {Authorization: `Bearer ${tokens.access_token}`},
    });

    let verified_email = null;
    let verified_emails = [];
    try {
        const user_emails = await http_get_json('https://api.github.com/user/emails', {
            headers: {Authorization: `Bearer ${tokens.access_token}`},
        });
        assert_shape(user_emails, assert_shape.array_of({
            email: String,
            primary: Boolean,
            verified: Boolean,
            visibility: assert_shape.enum(null, 'public'),
        }));
        verified_emails = user_emails.filter(v => v.verified).map(v => v.email);
        verified_email = user_emails.find(v => v.primary && v.verified && v.visibility === 'public')?.email ?? null;
    }
    catch (error) {
        als.logger.write(`[github_callback_get_user_emails_error] ${error.message}`);
    }

    const ident = await db('user_identities').where({
        type: const_user_identity.oauth_github,
        value_normalized: user_info.id,
    }).first();

    const oauth_intent = oauth_intent_from_state(state);
    const authorized_verified_emails = await authorize_oauth_verified_emails(verified_emails, {
        require_one_when_access_rules: oauth_intent === const_oauth_intent.login,
    });

    // Connect account flow
    if (oauth_intent === const_oauth_intent.connect) {

        if (!req.session.user_id) {
            throw new UserFriendlyError('Authentication required');
        }

        if (ident) {
            if (ident.user_id !== req.session.user_id) {
                await insert_auth_event({
                    req,
                    ident: {
                        type: const_user_identity.oauth_github,
                        value: String(user_info.id),
                        value_normalized: String(user_info.id),
                    },
                    event_type: const_auth_event.identity_added,
                    event_status: 'failure',
                    custom: {
                        reason: 'linked_to_another_user',
                    },
                });
                throw new UserFriendlyError('GitHub account already linked to another user');
            }
            // already connected
            await insert_auth_event({
                req,
                ident,
                event_type: const_auth_event.identity_added,
                event_status: 'noop',
                custom: {reason: 'already_connected'},
            });
            return redirect(req, res, '/auth/profile');
        }

        const now = new Date();
        await db('user_identities').insert({
            uid: random_uid_user_identity(),
            user_id: req.session.user_id,
            type: const_user_identity.oauth_github,
            value: String(user_info.id),
            value_normalized: String(user_info.id),
            created_at: now,
            updated_at: now,
            verified_at: now,
        });

        await insert_auth_event({
            req,
            ident: {
                type: const_user_identity.oauth_github,
                value: String(user_info.id),
                value_normalized: String(user_info.id),
            },
            event_type: const_auth_event.identity_added,
        });

        redirect(req, res, '/auth/profile');

        const user = await db('users').where({id: req.session.user_id}).first();
        const email_and_name = await get_user_email_and_name(req.session.user_id);
        if (email_and_name) {
            await send_email_nothrow({
                name: const_email.github_connected,
                user,
                placeholders: {
                    display_name: user.display_name,
                    date: format_date_pretty_24(new Date()),
                    ip: req.session.ip ?? 'n/a',
                    reset_link: config.public_url + urlmod(config.pages.password_reset_request, {email: email_and_name.email}),
                },
            });
        }
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
        await db.transaction(async function () {
            const now = new Date();
            const display_name = user_info.name;
            const avatar_url = user_info.avatar_url;
            const user = await users_create({display_name, avatar_url});
            user_id = user.id;
            await db('user_identities').insert({
                uid: random_uid_user_identity(),
                user_id,
                type: const_user_identity.oauth_github,
                value: String(user_info.id),
                value_normalized: String(user_info.id),
                created_at: now,
                updated_at: now,
                verified_at: now,
            });
            const primary_verified_email = authorized_verified_emails.find(v => v.email === verified_email);
            if (primary_verified_email) {
                await db('user_identities').insert({
                    uid: random_uid_user_identity(),
                    user_id,
                    type: const_user_identity.email,
                    value: primary_verified_email.email,
                    value_normalized: primary_verified_email.email_normalized,
                    created_at: now,
                    updated_at: now,
                    verified_at: now,
                }).onConflict(['type', 'value_normalized']).ignore();
            }
        });
    }

    const user = await db('users').where({id: user_id}).first();

    if (ident) {
        await complete_sign_in(req, res, user, ident);
    }
    else {
        await complete_sign_up(req, res, user, null, {
            type: const_user_identity.oauth_github,
            value: String(user_info.id),
            value_normalized: String(user_info.id),
        });
    }
}

// POST /auth/github/disconnect
async function github_disconnect_post(req, res)
{
    const user_id = req.session.user_id;
    const identities = await db('user_identities').where({user_id});
    const ident = identities.find(v => v.type === const_user_identity.oauth_github);

    if (!ident) {
        await insert_auth_event({
            req,
            ident: {type: const_user_identity.oauth_github},
            event_type: const_auth_event.identity_removed,
            event_status: 'noop',
            custom: {reason: 'not_connected'},
        });
        return redirect(req, res, '/auth/profile');
    }

    if (identities.length <= 1) {
        await insert_auth_event({
            req,
            ident,
            event_type: const_auth_event.identity_removed,
            event_status: 'failure',
            custom: {reason: 'last_identity'},
        });
        throw new UserFriendlyError('Cannot disconnect GitHub: it is your only sign-in method');
    }

    await db('user_identities').where({id: ident.id}).delete();

    await insert_auth_event({req, ident, event_type: const_auth_event.identity_removed});
    redirect(req, res, '/auth/profile');

    const user = await db('users').where({id: user_id}).first();
    const email_and_name = await get_user_email_and_name(user_id);
    if (email_and_name) {
        await send_email_nothrow({
            name: const_email.github_disconnected,
            user,
            placeholders: {
                display_name: user.display_name,
                date: format_date_pretty_24(new Date()),
                ip: req.session.ip ?? 'n/a',
                reset_link: config.public_url + urlmod(config.pages.password_reset_request, {email: email_and_name.email}),
            },
        });
    }
}

module.exports = routes;
