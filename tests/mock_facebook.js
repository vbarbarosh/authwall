const nock = require('nock');

function mock_facebook()
{
    const tokens = {
        access_token: 'fake-token',
        token_type: 'bearer',
        expires_in: 3600,
    };

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

    // The exchange must travel as a POST body, never as a query string.
    nock('https://graph.facebook.com')
        .post('/v22.0/oauth/access_token', function (body) {
            const form = typeof body === 'string' ? Object.fromEntries(new URLSearchParams(body)) : body;
            return form.code === 'fake_code'
                && /^.{24,}$/.test(form.code_verifier)
                && form.client_id === 'mocha_facebook_client_id'
                && form.client_secret === 'mocha_facebook_client_secret'
                && form.redirect_uri === 'mocha_facebook_redirect_url';
        })
        .reply(200, tokens);

    nock('https://graph.facebook.com', {reqheaders: {authorization: 'Bearer fake-token'}})
        .get('/v22.0/me')
        .query({fields: 'id,name,email,picture'})
        .reply(200, user_info);
}

module.exports = mock_facebook;
