const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const assign_primary_email = require('../assign_primary_email');
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
const is_recently_confirmed = require('../is_recently_confirmed');
const oauth_intent_from_state = require('../oauth_intent_from_state');
const oauth_state_from_intent = require('../oauth_state_from_intent');
const random_base62 = require('../random/random_base62');
const random_uid_user_identity = require('../random/random_uid_user_identity');
const redirect = require('../redirect');
const save_session = require('../save_session');
const send_confirm_code = require('../send_confirm_code');
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
    let intent = const_oauth_intent.login;
    if (req.query.connect) {
        intent = const_oauth_intent.connect;
    }
    if (req.query.confirm) {
        intent = const_oauth_intent.confirm;
    }
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
    const sub = oauth_sub(user_info.sub);

    const ident = await db('user_identities').where({
        type: oauth_provider.user_identity_type,
        value_normalized: sub,
    }).first();

    const oauth_intent = oauth_intent_from_state(state);
    if (oauth_intent === const_oauth_intent.confirm) {
        await confirm_with_provider(oauth_provider, req, res, ident);
        return;
    }
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
                        value: sub,
                        value_normalized: sub,
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

        // One account per provider (a unique index backs it): a second one,
        // linked from a borrowed session, would outlive the owner's (AW-24).
        const connected = await db('user_identities').where({user_id: req.session.user_id, type: oauth_provider.user_identity_type}).first();
        if (connected) {
            await insert_auth_event({
                req,
                ident: {
                    type: oauth_provider.user_identity_type,
                    value: sub,
                    value_normalized: sub,
                },
                event_type: const_auth_event.identity_added,
                event_status: const_auth_event_status.failure,
                custom: {reason: 'provider_already_connected'},
            });
            throw new UserFriendlyError(oauth_provider.error_already_connected);
        }

        // The primary address vouches for the owner. A provider account under
        // any other address waits until the owner confirms it is them (AW-24).
        if (!is_recently_confirmed(req) && !await returns_primary_email(req.session.user_id, oauth_provider, verified_emails)) {
            req.session.confirmation = {
                next: urlmod(oauth_provider.route_authorize, {connect: 1}),
                provider: oauth_provider.user_identity_type,
                provider_emails: verified_emails.map(v => v.email),
            };
            await save_session(req);
            await insert_auth_event({
                req,
                ident: {
                    type: oauth_provider.user_identity_type,
                    value: sub,
                    value_normalized: sub,
                },
                event_type: const_auth_event.identity_added,
                event_status: const_auth_event_status.noop,
                custom: {reason: 'confirmation_required'},
            });
            try {
                await send_confirm_code(req);
            }
            catch (error) {
                // No primary, no mailer, or a code already on its way: the
                // confirmation page offers the password.
                if (!(error instanceof UserFriendlyError)) {
                    throw error;
                }
            }
            return res.redirect(config.pages.confirm);
        }
        delete req.session.confirmation;

        const now = new Date();
        await db('user_identities').insert({
            uid: random_uid_user_identity(),
            user_id: req.session.user_id,
            type: oauth_provider.user_identity_type,
            value: sub,
            value_normalized: sub,
            created_at: now,
            updated_at: now,
            verified_at: now,
        });

        await insert_auth_event({
            req,
            ident: {
                type: oauth_provider.user_identity_type,
                value: sub,
                value_normalized: sub,
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
            await assign_primary_email(req.session.user_id);
        }

        redirect(req, res, '/auth/profile');

        const user = await db('users').where({id: req.session.user_id}).first();
        const email_and_name = await get_user_email_and_name(req.session.user_id);
        if (email_and_name) {
            await send_email_nothrow({
                name: oauth_provider.email_connected,
                user,
                verified_only: true,
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
                value: sub,
                value_normalized: sub,
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
                await assign_primary_email(user_id);
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
            value: sub,
            value_normalized: sub,
        });
    }
}

// A fresh sign-in with a provider account already linked to this user
// confirms it is the owner, as a code or the password does (routes/confirm.js).
// It is how an account with neither a primary address nor a password confirms.
async function confirm_with_provider(oauth_provider, req, res, ident)
{
    if (!req.session.user_id) {
        throw new UserFriendlyError('Authentication required');
    }
    const custom = {method: oauth_provider.user_identity_type};
    if (!ident || (ident.user_id !== req.session.user_id)) {
        await insert_auth_event({req, event_type: const_auth_event.identity_confirmed, event_status: const_auth_event_status.failure, custom});
        throw new UserFriendlyError('This account is not linked to yours. Sign in with an account you have linked.');
    }
    req.session.confirmed_at = new Date().toJSON();
    await save_session(req);
    await insert_auth_event({req, ident, event_type: const_auth_event.identity_confirmed, custom});
    res.redirect(req.session.confirmation?.next ?? config.pages.profile);
}

// A provider account vouches for the owner only when it returns the account's
// primary address and the provider verifies the addresses it returns.
async function returns_primary_email(user_id, oauth_provider, verified_emails)
{
    if (!oauth_provider.verifies_email) {
        return false;
    }
    const primary = await db('user_identities').where({user_id, type: const_user_identity.email}).whereNotNull('primary_at').first();
    return Boolean(primary) && verified_emails.some(v => v.email_normalized === primary.value_normalized);
}

// Providers disagree on the JSON type of the subject identifier: GitHub
// returns a number, the rest return strings. It is stored as text, so it has
// to be normalized once, here, before it is used for either the lookup or the
// insert. Letting the raw value reach the lookup is not a cosmetic problem —
// SQLite does not apply text affinity to a bound integer, so the query matches
// nothing, and a returning user falls through to the sign-up branch and dies
// on the unique constraint.
function oauth_sub(value)
{
    if (typeof value !== 'string' && typeof value !== 'number') {
        throw new UserFriendlyError('The provider did not return an account identifier');
    }

    const out = String(value).trim();
    if (!out) {
        throw new UserFriendlyError('The provider did not return an account identifier');
    }

    return out;
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
            verified_only: true,
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
