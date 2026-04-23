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

async function run_google_flow(client, opts)
{
    mock_google(opts);
    await client.get_json_no_redirects(opts.connect ? '/auth/google?connect=1' : '/auth/google');
    const {oauth_state} = await client.get_session();
    const url = urlmod('/auth/google/callback', {state: oauth_state, code: 'fake_code'});
    if (opts.no_redirects) {
        return client.get_json_no_redirects(url);
    }
    return client.get_json(url);
}

function assert_has_email_provider(status, email)
{
    assert.ok(status.providers.find(v => v.type === 'email' && v.value === email));
}

function assert_has_no_google_provider(status)
{
    assert.equal(status.providers.find(v => v.type === 'oauth_google'), undefined);
}

describe('Basic Google login only 2 | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.client_secret = 'mocha_google_client_secret';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.target.unset_headers = ['x-auth-user'];
        config.access.allowed_emails = ['jonny@gmail.com'];
        config.access.denied_emails = [];
        config.access.allowed_domains = [];
        config.access.denied_domains = [];
    });

    it('keeps the existing session and returns to /auth/profile when reconnecting google with a denied email', async function () {
        await run_google_flow(this.client, {
            sub: 'google-jonny',
            email: 'jonny@gmail.com',
        });

        const signed_in_status = await this.http_get_json('/auth/status');
        assert.equal(signed_in_status.authenticated, true);
        assert_has_email_provider(signed_in_status, 'jonny@gmail.com');
        assert.ok(signed_in_status.providers.find(v => v.type === 'oauth_google'));

        const signed_in_session = await this.client.get_session();

        await this.http_post_json('/auth/google/disconnect');

        const disconnected_status = await this.http_get_json('/auth/status');
        assert.equal(disconnected_status.authenticated, true);
        assert.equal(disconnected_status.error, null);
        assert.equal(disconnected_status.user_uid, signed_in_status.user_uid);
        assert_has_email_provider(disconnected_status, 'jonny@gmail.com');
        assert_has_no_google_provider(disconnected_status);

        const disconnected_session = await this.client.get_session();
        assert.equal(disconnected_session.uid, signed_in_session.uid);
        assert.equal(disconnected_session.user_uid, signed_in_session.user_uid);

        const res = await run_google_flow(this.client, {
            connect: true,
            no_redirects: true,
            sub: 'google-bobby',
            email: 'bobby@gmail.com',
        });

        assert.equal(res.status, 302);
        assert.equal(res.headers.location, '/auth/profile');

        const denied_status = await this.http_get_json('/auth/status');
        assert.equal(denied_status.authenticated, true);
        assert.equal(denied_status.error, 'Email is not allowed');
        assert.equal(denied_status.user_uid, signed_in_status.user_uid);
        assert_has_email_provider(denied_status, 'jonny@gmail.com');
        assert_has_no_google_provider(denied_status);

        const denied_session = await this.client.get_session();
        assert.equal(denied_session.uid, signed_in_session.uid);
        assert.equal(denied_session.user_uid, signed_in_session.user_uid);
    });
});
