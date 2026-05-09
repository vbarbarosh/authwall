const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const auth_middleware = require('../middleware/auth_middleware');
const authorize_oauth_verified_emails = require('../authorize_oauth_verified_emails');
const complete_sign_in = require('../../actions/complete_sign_in');
const complete_sign_up = require('../../actions/complete_sign_up');
const config = require('../../../config');
const const_auth_event = require('../const/const_auth_event');
const const_auth_event_status = require('../const/const_auth_event_status');
const const_oauth_intent = require('../const/const_oauth_intent');
const const_user_identity = require('../const/const_user_identity');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const csrf_middleware = require('../middleware/csrf_middleware');
const db = require('../../../db');
const format_date_pretty_24 = require('../format/format_date_pretty_24');
const get_user_email_and_name = require('../models/get_user_email_and_name');
const insert_auth_event = require('../insert_auth_event');
const oauth_intent_from_state = require('../oauth_intent_from_state');
const oauth_state_from_intent = require('../oauth_state_from_intent');
const random_base62 = require('../random/random_base62');
const random_uid_user_identity = require('../random/random_uid_user_identity');
const redirect = require('../redirect');
const save_session = require('../save_session');
const send_email_nothrow = require('../send_email_nothrow');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const users_create = require('../models/users_create');

function make_oauth_flow(oauth_provider)
{
    const {route_authorize, route_callback, route_disconnect} = oauth_provider;

    return [
        {req: `GET ${route_authorize}`, fn: authorize_get.bind(null, oauth_provider)},
        {req: `GET ${route_callback}`, fn: callback_get.bind(null, oauth_provider)},
        {req: `POST ${route_disconnect}`, fn: [auth_middleware, csrf_middleware, disconnect_post.bind(null, oauth_provider)]},
    ];
}

// GET /auth/google
async function authorize_get(oauth_provider, req, res)
{
    const intent = req.query.connect ? const_oauth_intent.connect : const_oauth_intent.login;
    const state = oauth_state_from_intent(intent);
    const oauth_code_verifier = random_base62(64);
    const code_challenge = crypto_hash_sha256(oauth_code_verifier).toString('base64url');
    const code_challenge_method = 'S256';

    req.session.oauth_state = state;
    req.session.oauth_code_verifier = oauth_code_verifier;
    await save_session(req);

    res.redirect(oauth_provider.build_authorization_url(state, code_challenge, code_challenge_method));
}

// GET /auth/google/callback
async function callback_get(oauth_provider, req, res)
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

    const tokens = await oauth_provider.exchange_code_for_tokens(code, oauth_code_verifier);
    const user_info = await oauth_provider.fetch_user_info(tokens);

    const ident = await db('user_identities').where({
        type: oauth_provider.user_identity_type,
        value_normalized: user_info.sub,
    }).first();

    const oauth_intent = oauth_intent_from_state(state);
    const verified_emails = await authorize_oauth_verified_emails(user_info.verified_emails,
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
                        type: oauth_provider.user_identity_type,
                        value: String(user_info.sub),
                        value_normalized: String(user_info.sub),
                    },
                    event_type: const_auth_event.identity_added,
                    event_status: const_auth_event_status.failure,
                    custom: {
                        reason: 'linked_to_another_user',
                    },
                });
                throw new UserFriendlyError(oauth_provider.error_already_linked_to_another_user);
            }
            // already connected
            await insert_auth_event({
                req,
                ident,
                event_type: const_auth_event.identity_added,
                event_status: const_auth_event_status.noop,
                custom: {reason: 'already_connected'},
            });
            return redirect(req, res, '/auth/profile');
        }

        const now = new Date();
        await db('user_identities').insert({
            uid: random_uid_user_identity(),
            user_id: req.session.user_id,
            type: oauth_provider.user_identity_type,
            value: String(user_info.sub),
            value_normalized: String(user_info.sub),
            created_at: now,
            updated_at: now,
            verified_at: now,
        });

        await insert_auth_event({
            req,
            ident: {
                type: oauth_provider.user_identity_type,
                value: String(user_info.sub),
                value_normalized: String(user_info.sub),
            },
            event_type: const_auth_event.identity_added,
        });

        // Also add the verified email if not already taken
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
                name: oauth_provider.email_connected,
                user,
                placeholders: {
                    display_name: user.display_name,
                    email: user_info.verified_emails[0] ?? '',
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
            const avatar_url = user_info.avatar;
            const user = await users_create({display_name, avatar_url});
            user_id = user.id;
            await db('user_identities').insert({
                uid: random_uid_user_identity(),
                user_id,
                type: oauth_provider.user_identity_type,
                value: String(user_info.sub),
                value_normalized: String(user_info.sub),
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
            type: oauth_provider.user_identity_type,
            value: String(user_info.sub),
            value_normalized: String(user_info.sub),
        });
    }
}

// POST /auth/google/disconnect
async function disconnect_post(oauth_provider, req, res)
{
    const user_id = req.session.user_id;
    const identities = await db('user_identities').where({user_id});
    const ident = identities.find(v => v.type === oauth_provider.user_identity_type);

    if (!ident) {
        await insert_auth_event({
            req,
            ident: {type: oauth_provider.user_identity_type},
            event_type: const_auth_event.identity_removed,
            event_status: const_auth_event_status.noop,
            custom: {reason: 'not_connected'},
        });
        return redirect(req, res, '/auth/profile');
    }

    if (identities.length <= 1) {
        await insert_auth_event({
            req,
            ident,
            event_type: const_auth_event.identity_removed,
            event_status: const_auth_event_status.failure,
            custom: {reason: 'last_identity'},
        });
        throw new UserFriendlyError(oauth_provider.error_last_auth_method);
    }

    await db('user_identities').where({id: ident.id}).delete();

    await insert_auth_event({req, ident, event_type: const_auth_event.identity_removed});
    redirect(req, res, '/auth/profile');

    const user = await db('users').where({id: user_id}).first();
    const email_and_name = await get_user_email_and_name(user_id);
    if (email_and_name) {
        await send_email_nothrow({
            name: oauth_provider.email_disconnected,
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

module.exports = make_oauth_flow;
