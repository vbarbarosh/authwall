const nock = require('nock');

const EXPECTED_BASIC = Buffer.from('mocha_twitter_client_id:mocha_twitter_client_secret').toString('base64');

function mock_twitter({email = 'test@example.com'} = {})
{
    const tokens = {
        access_token: 'fake-token',
        token_type: 'bearer',
        expires_in: 7200,
        scope: 'tweet.read users.read users.email',
    };

    const user_info = {
        data: {
            id: "123456789",
            name: "Test User",
            username: "testuser",
            profile_image_url: "https://example.com/twitter-avatar.jpg",
        }
    };

    if (email) {
        user_info.data.confirmed_email = email;
    }

    nock.cleanAll();

    nock('https://api.x.com', {
        reqheaders: {
            authorization: `Basic ${EXPECTED_BASIC}`,
            'content-type': /application\/x-www-form-urlencoded/,
        },
    })
        .post('/2/oauth2/token', body => {
            const params = new URLSearchParams(body);
            return params.get('grant_type') === 'authorization_code'
                && params.get('code') === 'fake_code'
                && params.get('redirect_uri') === 'mocha_twitter_redirect_url'
                && /^.{24,}$/.test(params.get('code_verifier') || '');
        })
        .reply(200, tokens);

    nock('https://api.x.com', {reqheaders: {authorization: 'Bearer fake-token'}})
        .get('/2/users/me')
        .query({'user.fields': 'confirmed_email,profile_image_url'})
        .reply(200, user_info);
}

module.exports = mock_twitter;
