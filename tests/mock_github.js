const nock = require('nock');

function mock_github()
{
    const user_info = {
        id: 'github-user-123',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
    };

    nock.cleanAll();

    nock('https://github.com')
        .post('/login/oauth/access_token')
        .reply(200, {
            access_token: 'fake-token',
            expires_in: 28800,
            refresh_token: 'ghr_xxx',
            refresh_token_expires_in: 15811200,
            token_type: 'bearer',
            scope: 'user:email',
        });

    nock('https://api.github.com')
        .get('/user')
        .reply(200, user_info);

    // nock('https://api.github.com')
    //     .get('/user/emails')
    //     .reply(200, []);

    nock('https://api.github.com')
        .get('/user/emails')
        .reply(200, [
            {
                email: 'jack@domain1.com',
                primary: true,
                verified: true,
                visibility: 'public'
            },
            {
                email: 'jack.m@domain2.com',
                primary: false,
                verified: true,
                visibility: null
            },
            {
                email: 'jj@domain3.com',
                primary: false,
                verified: true,
                visibility: null
            }
        ]);
}

module.exports = mock_github;
