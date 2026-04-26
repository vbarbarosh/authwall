const config = require('../../config');
const const_email = require('../helpers/const/const_email');
const const_user_identity = require('../helpers/const/const_user_identity');
const http_get_json = require('@vbarbarosh/node-helpers/src/http_get_json');
const http_post_urlencoded = require('@vbarbarosh/node-helpers/src/http_post_urlencoded');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const oauth_provider_twitter = {
    user_identity_type: const_user_identity.oauth_twitter,
    email_connected: const_email.twitter_connected,
    email_disconnected: const_email.twitter_disconnected,
    error_already_linked_to_another_user: 'X account already linked to another user',
    error_last_auth_method: 'Cannot disconnect X: it is your only sign-in method',
    route_authorize: '/auth/twitter',
    route_callback: '/auth/twitter/callback',
    route_disconnect: '/auth/twitter/disconnect',
    build_authorization_url,
    exchange_code_for_tokens,
    fetch_user_info,
};

function build_authorization_url(state, code_challenge, code_challenge_method)
{
    return urlmod('https://x.com/i/oauth2/authorize', {
        response_type: 'code',
        client_id: config.flows.twitter.client_id,
        redirect_uri: config.flows.twitter.redirect_url,
        scope: 'tweet.read users.read users.email',
        state,
        code_challenge,
        code_challenge_method,
    });
}

async function exchange_code_for_tokens(code, code_verifier)
{
    // X requires HTTP Basic auth for confidential clients (`client_secret_basic`).
    // Body-only credentials (`client_secret_post`) are rejected with 401 + WWW-Authenticate: Basic.

    const basic = Buffer.from(`${config.flows.twitter.client_id}:${config.flows.twitter.client_secret}`).toString('base64');
    const tokens = await http_post_urlencoded('https://api.x.com/2/oauth2/token', {
        grant_type: 'authorization_code',
        redirect_uri: config.flows.twitter.redirect_url,
        code,
        code_verifier,
    }, {
        headers: {Authorization: `Basic ${basic}`},
    });

    return tokens;
}

async function fetch_user_info(tokens)
{
    const user_info = await http_get_json(urlmod('https://api.x.com/2/users/me', {'user.fields': 'confirmed_email,profile_image_url'}), {
        headers: {Authorization: `Bearer ${tokens.access_token}`},
    });
    const tmp = user_info.data || {};

    return {
        sub: String(tmp.id),
        name: tmp.name || tmp.username || null,
        avatar: tmp.profile_image_url || null,
        verified_emails: [tmp.confirmed_email].filter(Boolean),
    };
}

module.exports = oauth_provider_twitter;
