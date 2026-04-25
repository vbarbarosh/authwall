const config = require('../../config');
const const_email = require('../helpers/const/const_email');
const const_user_identity = require('../helpers/const/const_user_identity');
const http_get_json = require('@vbarbarosh/node-helpers/src/http_get_json');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const oauth_provider_facebook = {
    user_identity_type: const_user_identity.oauth_facebook,
    email_connected: const_email.facebook_connected,
    email_disconnected: const_email.facebook_disconnected,
    error_already_linked_to_another_user: 'Facebook account already linked to another user',
    error_last_auth_method: 'Cannot disconnect Facebook: it is your only sign-in method',
    route_authorize: '/auth/facebook',
    route_callback: '/auth/facebook/callback',
    route_disconnect: '/auth/facebook/disconnect',
    build_authorization_url,
    exchange_code_for_tokens,
    fetch_user_info,
};

function build_authorization_url(state, code_challenge, code_challenge_method)
{
    return urlmod('https://www.facebook.com/v22.0/dialog/oauth', {
        client_id: config.flows.facebook.client_id,
        redirect_uri: config.flows.facebook.redirect_url,
        response_type: 'code',
        scope: 'email',
        state,
        code_challenge,
        code_challenge_method,
    });
}

async function exchange_code_for_tokens(code, code_verifier)
{
    const tokens = await http_get_json(urlmod('https://graph.facebook.com/v22.0/oauth/access_token', {
        client_id: config.flows.facebook.client_id,
        client_secret: config.flows.facebook.client_secret,
        redirect_uri: config.flows.facebook.redirect_url,
        code,
        code_verifier,
    }));

    return tokens;
}

async function fetch_user_info(tokens)
{
    const user_info = await http_get_json(urlmod('https://graph.facebook.com/v22.0/me', {fields: 'id,name,email,picture'}), {
        headers: {Authorization: `Bearer ${tokens.access_token}`},
    });

    return {
        sub: user_info.id,
        name: user_info.name || null,
        avatar: user_info.picture?.data?.url || null,
        verified_emails: [user_info.email].filter(Boolean),
    };
}

module.exports = oauth_provider_facebook;
