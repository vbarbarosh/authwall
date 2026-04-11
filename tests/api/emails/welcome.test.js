const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('emails • welcome', function () {

    it('should be sent after sign up via magic link', async function () {
        const email = 'mocha@authwall.test';

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email, _csrf: status.csrf_token});
        await this.client.get_json(this.sent_emails[0].placeholders.link);

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.magic_link, const_email.welcome];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after sign up via magic code', async function () {
        const email = 'mocha@authwall.test';

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email, _csrf: status.csrf_token});
        await this.client.post_json('/auth/magic-link/confirm', {email, code: this.sent_emails[0].placeholders.code, _csrf: status.csrf_token});

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

        config.google_client_id = 'mocha_google_client_id';
        config.google_redirect_url = 'mocha_google_redirect_url';

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

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.welcome];
        assert.deepStrictEqual(actual, expected);
    });

});
