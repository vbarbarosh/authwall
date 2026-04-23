const assert = require('assert');
const config = require('../../../config');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

function mock_google({sub, email})
{
    nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, {access_token: 'fake-token'});

    nock('https://www.googleapis.com')
        .get('/oauth2/v3/userinfo')
        .reply(200, {
            sub,
            name: 'Google User',
            picture: null,
            email,
            email_verified: true,
        });
}

async function sign_in_via_google(client, opts)
{
    mock_google(opts);
    await client.get_json_no_redirects('/auth/google');
    const sess = await client.get_session();
    await client.get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
}

describe('Basic Google login only | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.client_secret = 'mocha_google_client_secret';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.access.allowed_emails = ['jonny@gmail.com'];
        config.access.denied_emails = [];
        config.access.allowed_domains = [];
        config.access.denied_domains = [];
    });

    it('allows jonny@gmail.com to sign in via google', async function () {
        await sign_in_via_google(this.client, {
            sub: 'google-jonny',
            email: 'jonny@gmail.com',
        });

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            authenticated: true,
            error: null,
        });
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'jonny@gmail.com'));
    });

    it('rejects bobby@gmail.com when no prior account exists', async function () {
        await sign_in_via_google(this.client, {
            sub: 'google-bobby-new',
            email: 'bobby@gmail.com',
        });

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: false,
            error: 'Email is not allowed',
        });
    });

    it('rejects bobby@gmail.com even when bobby was registered previously', async function () {
        await this.add_user({email: 'bobby@gmail.com', password: 'pass1234'});

        await sign_in_via_google(this.client, {
            sub: 'google-bobby-existing',
            email: 'bobby@gmail.com',
        });

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: false,
            error: 'Email is not allowed',
        });
    });
});
