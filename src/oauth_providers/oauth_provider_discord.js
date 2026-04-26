const config = require('../../config');
const const_email = require('../helpers/const/const_email');
const const_user_identity = require('../helpers/const/const_user_identity');
const http_get_json = require('@vbarbarosh/node-helpers/src/http_get_json');
const http_post_urlencoded = require('@vbarbarosh/node-helpers/src/http_post_urlencoded');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const oauth_provider_discord = {
    user_identity_type: const_user_identity.oauth_discord,
    email_connected: const_email.discord_connected,
    email_disconnected: const_email.discord_disconnected,
    error_already_linked_to_another_user: 'Discord account already linked to another user',
    error_last_auth_method: 'Cannot disconnect Discord: it is your only sign-in method',
    route_authorize: '/auth/discord',
    route_callback: '/auth/discord/callback',
    route_disconnect: '/auth/discord/disconnect',
    build_authorization_url,
    exchange_code_for_tokens,
    fetch_user_info,
};

function build_authorization_url(state, code_challenge, code_challenge_method)
{
    return urlmod('https://discord.com/oauth2/authorize', {
        client_id: config.flows.discord.client_id,
        redirect_uri: config.flows.discord.redirect_url,
        response_type: 'code',
        scope: 'identify email',
        prompt: 'consent',
        state,
        code_challenge,
        code_challenge_method,
    });
}

async function exchange_code_for_tokens(code, code_verifier)
{
    const tokens = await http_post_urlencoded('https://discord.com/api/oauth2/token', {
        client_id: config.flows.discord.client_id,
        client_secret: config.flows.discord.client_secret,
        redirect_uri: config.flows.discord.redirect_url,
        grant_type: 'authorization_code',
        code,
        code_verifier,
    });

    return tokens;
}

async function fetch_user_info(tokens)
{
    const user_info = await http_get_json('https://discord.com/api/users/@me', {
        headers: {Authorization: `Bearer ${tokens.access_token}`},
    });

    return {
        sub: String(user_info.id),
        name: user_info.global_name || user_info.username || null,
        avatar: avatar_url(user_info),
        verified_emails: user_info.verified && user_info.email ? [user_info.email] : [],
    };
}

function avatar_url(user_info)
{
    if (!user_info.avatar) {
        return null;
    }

    const ext = user_info.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user_info.id}/${user_info.avatar}.${ext}`;
}

module.exports = oauth_provider_discord;
