const nock = require('nock');

function mock_microsoft()
{
    const user_info = {
        sub: 'microsoft-user-123',
        name: 'Test User',
        email: 'test@example.com',
    };

    nock.cleanAll();

    nock('https://login.microsoftonline.com')
        .post('/common/oauth2/v2.0/token')
        .reply(200, {
            access_token: 'fake-token',
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid email profile',
        });

    nock('https://login.microsoftonline.com')
        .get('/common/v2.0/.well-known/openid-configuration')
        .reply(200, {
            userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
        });

    nock('https://graph.microsoft.com')
        .get('/oidc/userinfo')
        .reply(200, user_info);
}

module.exports = mock_microsoft;
