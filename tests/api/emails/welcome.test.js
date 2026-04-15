const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('emails • welcome', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.github.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    afterEach(function () {
        config.flows.google.enabled = false;
        config.flows.github.enabled = false;
    });

    it('should be sent after sign up via magic link', async function () {
        const email = 'mocha@authwall.test';

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email, _csrf: status.csrf_token});
        await this.client.get_json(this.sent_emails[0].placeholders.link);
        await this.wait_for_emails(2);

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.magic_link, const_email.welcome];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after sign up via magic code', async function () {
        const email = 'mocha@authwall.test';

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email, _csrf: status.csrf_token});
        await this.client.post_json('/auth/magic-link/confirm', {email, code: this.sent_emails[0].placeholders.code, _csrf: status.csrf_token});
        await this.wait_for_emails(2);

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.magic_link, const_email.welcome];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after Google login for the first time', async function () {

        nock('https://oauth2.googleapis.com')
            .post('/token')
            .reply(200, {access_token: 'fake-token'});

        nock('https://www.googleapis.com')
            .get('/oauth2/v3/userinfo')
            .reply(200, {
                sub: 'google-user-123',
                name: 'Test User',
                picture: 'https://example.com/avatar.jpg',
                email: 'test@example.com',
                email_verified: true,
            });

        await this.client.get_json_no_redirects('/auth/google');
        const sess = await this.client.get_session();

        await this.client.get_json(urlmod('/auth/google/callback', {
            state: sess.oauth_state,
            iss: 'https://accounts.google.com',
            code: '4/fake_code',
            scope: 'email profile https://www.googleapis.com/auth/userinfo.profile openid https://www.googleapis.com/auth/userinfo.email',
            authuser: '0',
            prompt: 'none'
        }));
        await this.wait_for_emails(1);

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.welcome];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after GitHub login for the first time', async function () {

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

        await this.client.get_json_no_redirects('/auth/github');
        const sess = await this.client.get_session();

        await this.client.get_json(urlmod('/auth/github/callback', {
            code: "4/fake_code",
            state: sess.oauth_state,
        }));
        await this.wait_for_emails(1);

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.welcome];
        assert.deepStrictEqual(actual, expected);
    });

});
