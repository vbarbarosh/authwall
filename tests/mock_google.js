const nock = require('nock');

function mock_google()
{
    const tokens = {
        access_token: 'fake-token'
    };

    const user_info = {
        sub: 'google-user-123',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        email: 'test@example.com',
        email_verified: true,
    };

    nock.cleanAll();
    nock('https://oauth2.googleapis.com').post('/token').reply(200, tokens);
    nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, user_info);
}

module.exports = mock_google;
