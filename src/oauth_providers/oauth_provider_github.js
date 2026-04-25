const assert_shape = require('../helpers/assert/assert_shape');
const config = require('../../config');
const const_email = require('../helpers/const/const_email');
const const_user_identity = require('../helpers/const/const_user_identity');
const http_get_json = require('@vbarbarosh/node-helpers/src/http_get_json');
const http_post_json = require('../http/http_post_json');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const oauth_provider_github = {
    user_identity_type: const_user_identity.oauth_github,
    email_connected: const_email.github_connected,
    email_disconnected: const_email.github_disconnected,
    error_already_linked_to_another_user: 'GitHub account already linked to another user',
    error_last_auth_method: 'Cannot disconnect GitHub: it is your only sign-in method',
    route_authorize: '/auth/github',
    route_callback: '/auth/github/callback',
    route_disconnect: '/auth/github/disconnect',
    build_authorization_url,
    exchange_code_for_tokens,
    fetch_user_info,
};

function build_authorization_url(state, code_challenge, code_challenge_method)
{
    return urlmod('https://github.com/login/oauth/authorize', {
        client_id: config.flows.github.client_id,
        redirect_uri: config.flows.github.redirect_url,
        scope: 'user:email',
        prompt: 'select_account',
        state,
        code_challenge,
        code_challenge_method,
    });
}

async function exchange_code_for_tokens(code, code_verifier)
{
    const tokens = await http_post_json('https://github.com/login/oauth/access_token', {
        client_id: config.flows.github.client_id,
        client_secret: config.flows.github.client_secret,
        redirect_uri: config.flows.github.redirect_url,
        code,
        code_verifier,
    });

    return tokens;
}

async function fetch_user_info(tokens)
{
    const user_info = await http_get_json('https://api.github.com/user', {
        headers: {Authorization: `Bearer ${tokens.access_token}`},
    });

    const user_emails = await http_get_json('https://api.github.com/user/emails', {
        headers: {Authorization: `Bearer ${tokens.access_token}`},
    });

    assert_shape(user_emails, assert_shape.array_of({
        email: String,
        primary: Boolean,
        verified: Boolean,
        visibility: assert_shape.enum(null, 'public'),
    }));

    return {
        sub: user_info.id,
        name: user_info.name,
        avatar: user_info.avatar_url,
        verified_emails: user_emails.filter(v => v.verified).sort(fcmp_user_emails).map(v => v.email),
    };
}

function fcmp_user_emails(a, b)
{
    return Number(b.primary) - Number(a.primary);
}

module.exports = oauth_provider_github;
