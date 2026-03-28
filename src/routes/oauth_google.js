const complete_sign_in = require('../actions/complete_sign_in');
const config = require('../../config');
const const_oauth_intent = require('../helpers/const/const_oauth_intent');
const const_user_identity = require('../helpers/const/const_user_identity');
const db = require('../../db');
const http_get_json = require('@vbarbarosh/node-helpers/src/http_get_json');
const http_post_urlencoded = require('@vbarbarosh/node-helpers/src/http_post_urlencoded');
const normalize_email = require('../helpers/normalize/normalize_email');
const oauth_intent_from_state = require('../helpers/oauth_intent_from_state');
const oauth_state_from_intent = require('../helpers/oauth_state_from_intent');
const redirect = require('../helpers/redirect');
const save_session = require('../helpers/save_session');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const users_create = require('../helpers/models/users_create');

const routes = [
    {req: 'GET /auth/google', fn: google_get},
    {req: 'GET /auth/google/callback', fn: google_callback_get},
];

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
            value: null,
            value_normalized: userinfo.sub,
            created_at: now,
            updated_at: now,
            verified_at: now,
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
            const display_name = userinfo.name;
            const avatar_url = userinfo.picture;
            const user = await users_create({trx, display_name, avatar_url});
            user_id = user.id;
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
    await complete_sign_in(req, res, user);
}

module.exports = routes;
