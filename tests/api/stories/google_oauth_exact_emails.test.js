const assert = require('assert');
const config = require('../../../config');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

function mock_google({sub, email, email_verified = true})
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
            email_verified,
        });
}

async function sign_in_via_google(client, opts)
{
    mock_google(opts);
    await client.get_json_no_redirects('/auth/google');
    const sess = await client.get_session();
    await client.get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
}

describe('Google OAuth with exact email allow-list | stories', function () {
    let access;

    beforeEach(function () {
        access = {
            allowed_emails: [...config.access.allowed_emails],
            denied_emails: [...config.access.denied_emails],
            allowed_domains: [...config.access.allowed_domains],
            denied_domains: [...config.access.denied_domains],
        };

        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.access.allowed_emails = ['alice@authwall.test', 'bob@authwall.test'];
        config.access.allowed_domains = [];
        config.access.denied_emails = [];
        config.access.denied_domains = [];
    });

    it('allows a Google login with a listed verified email', async function () {
        await sign_in_via_google(this.client, {
            sub: 'google-alice',
            email: 'alice@authwall.test',
        });

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            authenticated: true,
            error: null,
        });
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'alice@authwall.test'));
    });

    it('rejects a Google login with an unlisted verified email', async function () {
        await sign_in_via_google(this.client, {
            sub: 'google-mallory',
            email: 'mallory@authwall.test',
        });

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: false,
            error: 'Email is not allowed',
        });
    });

    it('rejects a Google login without a verified email', async function () {
        await sign_in_via_google(this.client, {
            sub: 'google-no-email',
            email: null,
            email_verified: false,
        });

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: false,
            error: 'A verified email is required',
        });
    });
});
