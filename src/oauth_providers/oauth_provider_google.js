const config = require('../../config');
const const_email = require('../helpers/const/const_email');
const const_user_identity = require('../helpers/const/const_user_identity');
const http_get_json = require('@vbarbarosh/node-helpers/src/http_get_json');
const http_post_urlencoded = require('@vbarbarosh/node-helpers/src/http_post_urlencoded');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const oauth_provider_google = {
    user_identity_type: const_user_identity.oauth_google,
    email_connected: const_email.google_connected,
    email_disconnected: const_email.google_disconnected,
    error_already_linked_to_another_user: 'Google account already linked to another user',
    error_last_auth_method: 'Cannot disconnect Google: it is your only sign-in method',
    route_authorize: '/auth/google',
    route_callback: '/auth/google/callback',
    route_disconnect: '/auth/google/disconnect',
    build_authorization_url,
    exchange_code_for_tokens,
    fetch_user_info,
};

function build_authorization_url(state, code_challenge, code_challenge_method)
{
    return urlmod('https://accounts.google.com/o/oauth2/v2/auth', {
        client_id: config.flows.google.client_id,
        redirect_uri: config.flows.google.redirect_url,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
        state,
        code_challenge,
        code_challenge_method,
    });
}

async function exchange_code_for_tokens(code, code_verifier)
{
    const tokens = await http_post_urlencoded('https://oauth2.googleapis.com/token', {
        client_id: config.flows.google.client_id,
        client_secret: config.flows.google.client_secret,
        redirect_uri: config.flows.google.redirect_url,
        grant_type: 'authorization_code',
        code,
        code_verifier,
    });

    return tokens;
}

async function fetch_user_info(tokens)
{
    const user_info = await http_get_json('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {Authorization: `Bearer ${tokens.access_token}`},
    });

    return {
        sub: user_info.sub,
        name: user_info.name,
        avatar: user_info.picture,
        verified_emails: user_info.email_verified ? [user_info.email] : [],
    };
}

module.exports = oauth_provider_google;
