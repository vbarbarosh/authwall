const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
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
const insert_auth_event = require('../helpers/insert_auth_event');
const oauth_intent_from_state = require('../helpers/oauth_intent_from_state');
const oauth_state_from_intent = require('../helpers/oauth_state_from_intent');
const random_uid_user_identity = require('../helpers/random/random_uid_user_identity');
const redirect = require('../helpers/redirect');
const save_session = require('../helpers/save_session');
const send_email_nothrow = require('../helpers/send_email_nothrow');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const users_create = require('../helpers/models/users_create');
const random_base62 = require('../helpers/random/random_base62');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');

const FACEBOOK_AUTHORIZE_URL = 'https://www.facebook.com/v22.0/dialog/oauth';
const FACEBOOK_TOKEN_URL = 'https://graph.facebook.com/v22.0/oauth/access_token';
const FACEBOOK_ME_URL = 'https://graph.facebook.com/v22.0/me';

const routes = [
    {req: 'GET /auth/facebook', fn: facebook_get},
    {req: 'GET /auth/facebook/callback', fn: facebook_callback_get},
    {prepend: [auth_middleware, csrf_middleware], routes: [
        {req: 'POST /auth/facebook/disconnect', fn: facebook_disconnect_post},
    ]},
];

// GET /auth/facebook
async function facebook_get(req, res)
{
    const intent = req.query.connect ? const_oauth_intent.connect : const_oauth_intent.login;
    const state = oauth_state_from_intent(intent);

    req.session.oauth_state = state;
    req.session.oauth_code_verifier = random_base62(64);
    await save_session(req);

    res.redirect(urlmod(FACEBOOK_AUTHORIZE_URL, {
        client_id: config.flows.facebook.client_id,
        redirect_uri: config.flows.facebook.redirect_url,
        response_type: 'code',
        scope: 'email',
        state,
        code_challenge: crypto_hash_sha256(req.session.oauth_code_verifier).toString('base64url'),
        code_challenge_method: 'S256',
    }));
}

// GET /auth/facebook/callback
async function facebook_callback_get(req, res)
{
    const {code, state} = req.query;
    const {oauth_state, oauth_code_verifier} = req.session;

    // Prevent accidentally losing state on invalid requests
    // delete req.session.oauth_state;

    if (!code) {
        throw new UserFriendlyError('Missing OAuth code');
    }
    if (!state || state !== oauth_state) {
        throw new UserFriendlyError('Invalid OAuth state');
    }

    delete req.session.oauth_state;
    delete req.session.oauth_code_verifier;

    const tokens = await http_get_json(urlmod(FACEBOOK_TOKEN_URL, {
        code,
        code_verifier: oauth_code_verifier,
        client_id: config.flows.facebook.client_id,
        client_secret: config.flows.facebook.client_secret,
        redirect_uri: config.flows.facebook.redirect_url,
    }));

    const user_info = await http_get_json(urlmod(FACEBOOK_ME_URL, {
        fields: 'id,name,email,picture',
    }), {
        headers: {Authorization: `Bearer ${tokens.access_token}`},
    });

    const ident = await db('user_identities').where({
        type: const_user_identity.oauth_facebook,
        value_normalized: user_info.id,
    }).first();

    const oauth_intent = oauth_intent_from_state(state);
    const verified_emails = await authorize_oauth_verified_emails(
        user_info.email ? [user_info.email] : [],
        {require_one_when_access_rules: oauth_intent === const_oauth_intent.login}
    );

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
                        type: const_user_identity.oauth_facebook,
                        value: String(user_info.id),
                        value_normalized: String(user_info.id),
                    },
                    event_type: const_auth_event.identity_added,
                    event_status: 'failure',
                    custom: {
                        reason: 'linked_to_another_user',
                    },
                });
                throw new UserFriendlyError('Facebook account already linked to another user');
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
            type: const_user_identity.oauth_facebook,
            value: String(user_info.id),
            value_normalized: String(user_info.id),
            created_at: now,
            updated_at: now,
            verified_at: now,
        });

        await insert_auth_event({
            req,
            ident: {
                type: const_user_identity.oauth_facebook,
                value: String(user_info.id),
                value_normalized: String(user_info.id),
            },
            event_type: const_auth_event.identity_added,
        });

        const verified_email = verified_emails[0];
        if (verified_email) {
            await db('user_identities').insert({
                uid: random_uid_user_identity(),
                user_id: req.session.user_id,
                type: const_user_identity.email,
                value: verified_email.email,
                value_normalized: verified_email.email_normalized,
                created_at: now,
                updated_at: now,
                verified_at: now,
            }).onConflict(['type', 'value_normalized']).ignore();
        }

        redirect(req, res, '/auth/profile');

        const user = await db('users').where({id: req.session.user_id}).first();
        const email_and_name = await get_user_email_and_name(req.session.user_id);
        if (email_and_name) {
            await send_email_nothrow({
                name: const_email.facebook_connected,
                user,
                placeholders: {
                    display_name: user.display_name,
                    facebook_email: user_info.email ?? '',
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
            const avatar_url = user_info.picture?.data?.url ?? null;
            const user = await users_create({display_name, avatar_url});
            user_id = user.id;
            await db('user_identities').insert({
                uid: random_uid_user_identity(),
                user_id,
                type: const_user_identity.oauth_facebook,
                value: String(user_info.id),
                value_normalized: String(user_info.id),
                created_at: now,
                updated_at: now,
                verified_at: now,
            });
            const verified_email = verified_emails[0];
            if (verified_email) {
                await db('user_identities').insert({
                    uid: random_uid_user_identity(),
                    user_id,
                    type: const_user_identity.email,
                    value: verified_email.email,
                    value_normalized: verified_email.email_normalized,
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
            type: const_user_identity.oauth_facebook,
            value: String(user_info.id),
            value_normalized: String(user_info.id),
        });
    }
}

// POST /auth/facebook/disconnect
async function facebook_disconnect_post(req, res)
{
    const user_id = req.session.user_id;
    const identities = await db('user_identities').where({user_id});
    const ident = identities.find(v => v.type === const_user_identity.oauth_facebook);

    if (!ident) {
        await insert_auth_event({
            req,
            ident: {type: const_user_identity.oauth_facebook},
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
        throw new UserFriendlyError('Cannot disconnect Facebook: it is your only sign-in method');
    }

    await db('user_identities').where({id: ident.id}).delete();

    await insert_auth_event({req, ident, event_type: const_auth_event.identity_removed});
    redirect(req, res, '/auth/profile');

    const user = await db('users').where({id: user_id}).first();
    const email_and_name = await get_user_email_and_name(user_id);
    if (email_and_name) {
        await send_email_nothrow({
            name: const_email.facebook_disconnected,
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
