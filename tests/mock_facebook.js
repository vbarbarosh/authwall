const nock = require('nock');

function mock_facebook()
{
    const userinfo = {
        id: 'facebook-user-123',
        name: 'Test User',
        email: 'test@example.com',
        picture: {
            data: {
                url: 'https://example.com/facebook-avatar.jpg',
            },
        },
    };

    nock.cleanAll();

    nock('https://graph.facebook.com')
        .get('/v22.0/oauth/access_token')
        .query({
            code: 'fake_code',
            client_id: 'mocha_facebook_client_id',
            client_secret: 'mocha_facebook_client_secret',
            redirect_uri: 'mocha_facebook_redirect_url',
        })
        .reply(200, {
            access_token: 'fake-token',
            token_type: 'bearer',
            expires_in: 3600,
        });

    nock('https://graph.facebook.com', {
        reqheaders: {
            authorization: 'Bearer fake-token',
        },
    })
        .get('/v22.0/me')
        .query({fields: 'id,name,email,picture'})
        .reply(200, userinfo);
}

module.exports = mock_facebook;
