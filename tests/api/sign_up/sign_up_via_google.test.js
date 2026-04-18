const assert = require('assert');
const config = require('../../../config');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('sign up via google | scenarios', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';

        nock.cleanAll();

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
    });

    afterEach(function () {
        config.flows.google.enabled = false;
    });

    it('signup via google should mark the email as verified', async function () {
        const r = await this.client.get_json_no_redirects('/auth/google');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, urlmod('https://accounts.google.com/o/oauth2/v2/auth', {
            client_id: 'mocha_google_client_id',
            redirect_uri: 'mocha_google_redirect_url',
            response_type: 'code',
            scope: 'openid email profile',
            access_type: 'offline',
            prompt: 'select_account',
            state: sess.oauth_state,
        }));

        await this.http_get_json(urlmod('/auth/google/callback', {
            state: sess.oauth_state,
            iss: 'https://accounts.google.com',
            code: '4/fake_code',
            scope: 'email profile https://www.googleapis.com/auth/userinfo.profile openid https://www.googleapis.com/auth/userinfo.email',
            authuser: '0',
            prompt: 'none'
        }));
        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
            display_name: 'Test User',
            avatar_url: 'https://example.com/avatar.jpg',
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_google' && v.value === 'google-user-123').verified_at !== null);
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'test@example.com').verified_at !== null);
    });

});
