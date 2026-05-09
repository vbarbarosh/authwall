const assert = require('assert');
const config = require('../../../config');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const nock = require('nock');
const normalize_email = require('../../../src/helpers/normalize/normalize_email');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const const_auth_event_status = require('../../../src/helpers/const/const_auth_event_status');

function mock_google({sub = 'google-sub-123', email = null} = {})
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
            email_verified: email !== null,
        });
}

function mock_github({id = 'github-sub-123', emails = []} = {})
{
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
            id,
            name: 'GitHub User',
            avatar_url: null,
        });

    nock('https://api.github.com')
        .get('/user/emails')
        .reply(200, emails);
}

async function sign_in_via_google(client, opts)
{
    mock_google(opts);
    await client.get_json_no_redirects('/auth/google');
    const sess = await client.get_session();
    await client.get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
}

async function sign_in_via_github(client, opts)
{
    mock_github(opts);
    await client.get_json_no_redirects('/auth/github');
    const sess = await client.get_session();
    await client.get_json(urlmod('/auth/github/callback', {state: sess.oauth_state, code: 'fake_code'}));
}

describe('OAuth login with allow-list | stories', function () {
    let access;

    beforeEach(function () {
        access = {
            allowed_emails: [...config.access.allowed_emails],
            denied_emails: [...config.access.denied_emails],
            allowed_domains: [...config.access.allowed_domains],
            denied_domains: [...config.access.denied_domains],
        };

        config.flows.github.enabled = true;
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.access.allowed_domains = ['authwall.test'];
        config.access.allowed_emails = [];
        config.access.denied_domains = [];
        config.access.denied_emails = [];
    });

    it('rejects google login when no verified email is provided and access rules are active', async function () {
        await sign_in_via_google(this.client, {email: null});

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: false,
            error: 'A verified email is required',
        });
    });

    it('allows google login when the verified email passes the allow-list', async function () {
        await sign_in_via_google(this.client, {email: 'person@authwall.test'});

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            authenticated: true,
            error: null,
        });
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'person@authwall.test'));
    });

    it('records one failed auth event when Google login email is not allowed', async function () {
        config.access.allowed_domains = [];
        config.access.allowed_emails = ['allowed@authwall.test'];
        await db('auth_events').del();

        await sign_in_via_google(this.client, {
            sub: 'google-blocked-new',
            email: 'other@authwall.test',
        });

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: false,
            error: 'Email is not allowed',
        });

        console.log(await db('auth_events'));

        const events = await db('auth_events').orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.change_me_email_not_authorized,
            event_status: const_auth_event_status.failure,
        });
    });

    it('rejects github login when no verified email is provided and access rules are active', async function () {
        await sign_in_via_github(this.client, {emails: []});

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: false,
            error: 'A verified email is required',
        });
    });

    it('rejects github login when any verified email fails authorize_email', async function () {
        await sign_in_via_github(this.client, {
            emails: [
                {email: 'person@authwall.test', primary: true, verified: true, visibility: 'public'},
                {email: 'person@blocked.test', primary: false, verified: true, visibility: null},
            ],
        });

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: false,
            error: 'Email domain is not allowed',
        });
    });
});
