const config = require('../../config');
const const_email = require('../helpers/const/const_email');
const const_user_identity = require('../helpers/const/const_user_identity');
const http_get_json = require('@vbarbarosh/node-helpers/src/http_get_json');
const http_post_urlencoded = require('@vbarbarosh/node-helpers/src/http_post_urlencoded');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const oauth_provider_microsoft = {
    user_identity_type: const_user_identity.oauth_microsoft,
    email_connected: const_email.microsoft_connected,
    email_disconnected: const_email.microsoft_disconnected,
    error_already_linked_to_another_user: 'Microsoft account already linked to another user',
    error_last_auth_method: 'Cannot disconnect Microsoft: it is your only sign-in method',
    route_authorize: '/auth/microsoft',
    route_callback: '/auth/microsoft/callback',
    route_disconnect: '/auth/microsoft/disconnect',
    build_authorization_url,
    exchange_code_for_tokens,
    fetch_user_info,
};

function build_authorization_url(state, code_challenge, code_challenge_method)
{
    return urlmod('https://login.microsoftonline.com/common/oauth2/v2.0/authorize', {
        client_id: config.flows.microsoft.client_id,
        redirect_uri: config.flows.microsoft.redirect_url,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'select_account',
        state,
        code_challenge,
        code_challenge_method,
    });
}

async function exchange_code_for_tokens(code, code_verifier)
{
    const tokens = await http_post_urlencoded('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        client_id: config.flows.microsoft.client_id,
        client_secret: config.flows.microsoft.client_secret,
        redirect_uri: config.flows.microsoft.redirect_url,
        grant_type: 'authorization_code',
        code,
        code_verifier,
    });

    return tokens;
}

async function fetch_user_info(token)
{
    const openid_config = await http_get_json('https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration');
    const user_info = await http_get_json(openid_config.userinfo_endpoint, {
        headers: {Authorization: `Bearer ${token.access_token}`},
    });

    return {
        sub: user_info.sub,
        name: `${user_info.givenname} ${user_info.familyname}`.trim() || null,
        avatar: null,
        verified_emails: [user_info.email].filter(Boolean),
    };
}

module.exports = oauth_provider_microsoft;
