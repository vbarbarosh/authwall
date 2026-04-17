const nock = require('nock');

function mock_google()
{
    const userinfo = {
        sub: 'google-user-123',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        email: 'test@example.com',
        email_verified: true,
    };

    nock.cleanAll();

    nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, {access_token: 'fake-token'});

    nock('https://www.googleapis.com')
        .get('/oauth2/v3/userinfo')
        .reply(200, userinfo);
}

module.exports = mock_google;
