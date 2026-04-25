const nock = require('nock');

function mock_facebook()
{
    const user_info = {
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
            code_verifier: /^.{24,}$/,
            client_id: 'mocha_facebook_client_id',
            client_secret: 'mocha_facebook_client_secret',
            redirect_uri: 'mocha_facebook_redirect_url',
        })
        .reply(200, {
            access_token: 'fake-token',
            token_type: 'bearer',
            expires_in: 3600,
        });

    nock('https://graph.facebook.com', {reqheaders: {authorization: 'Bearer fake-token'}})
        .get('/v22.0/me')
        .query({fields: 'id,name,email,picture'})
        .reply(200, user_info);
}

module.exports = mock_facebook;
