const assert = require('assert');
const config = require('../../../config');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('sign up via github | scenarios', function () {

    beforeEach(function () {
        config.flows.github.enabled = true;
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';

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
            .reply(200, {
                id: 'github-user-123',
                name: 'Test User',
                avatar_url: 'https://example.com/avatar.jpg',
            });

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
    });

    afterEach(function () {
        config.flows.github.enabled = false;
    });

    it('signup via github should mark the email as verified', async function () {
        const r = await this.client.get_json_no_redirects('/auth/github');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, urlmod('https://github.com/login/oauth/authorize', {
            client_id: config.flows.github.client_id,
            redirect_uri: config.flows.github.redirect_url,
            scope: 'user:email',
            prompt: 'select_account',
            state: sess.oauth_state,
        }));

        await this.client.get_json(urlmod('/auth/github/callback', {
            code: "4/fake_code",
            state: sess.oauth_state,
        }));
        const status = await this.client.get_json('/auth/status');
        assert.strictEqual(status.error, null);
        assert.strictEqual(status.authenticated, true);
        assert.strictEqual(status.display_name, 'Test User');
        assert.strictEqual(status.avatar_url, 'https://example.com/avatar.jpg');
        assert.ok(status.providers.find(v => v.type === 'oauth_github' && v.value === 'github-user-123').verified_at !== null);
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'jack@domain1.com').verified_at !== null);
    });

});
