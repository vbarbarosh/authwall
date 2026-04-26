const nock = require('nock');

function mock_discord({email = 'test@example.com', verified = true} = {})
{
    const user_info = {
        id: '123456789123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: 'discord-avatar-hash',
        verified,
        email,
    };

    nock.cleanAll();

    nock('https://discord.com', {
        reqheaders: {
            'content-type': /application\/x-www-form-urlencoded/,
        },
    })
        .post('/api/oauth2/token', body => {
            const params = new URLSearchParams(body);
            return params.get('grant_type') === 'authorization_code'
                && params.get('client_id') === 'mocha_discord_client_id'
                && params.get('client_secret') === 'mocha_discord_client_secret'
                && params.get('redirect_uri') === 'mocha_discord_redirect_url'
                && params.get('code') === 'fake_code'
                && /^.{24,}$/.test(params.get('code_verifier') || '');
        })
        .reply(200, {
            access_token: 'fake-token',
            token_type: 'Bearer',
            expires_in: 604800,
            refresh_token: 'fake-refresh-token',
            scope: 'identify email',
        });

    nock('https://discord.com', {reqheaders: {authorization: 'Bearer fake-token'}})
        .get('/api/users/@me')
        .reply(200, user_info);
}

module.exports = mock_discord;
