const assert = require('assert');
const config = require('../../../config');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_auth_event_status = require('../../../src/helpers/const/const_auth_event_status');
const db = require('../../../db');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

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

async function sign_in_via_google(client, opts)
{
    mock_google(opts);
    await client.get_json_no_redirects('/auth/google');
    const sess = await client.get_session();
    await client.get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
}

describe('auth_events • change_me_email_not_authorized', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.access.allowed_domains = ['authwall.test'];
        config.access.allowed_emails = [];
        config.access.denied_domains = [];
        config.access.denied_emails = [];
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

        const events = await db('auth_events').orderBy('id');
        assert.strictEqual(events.length, 1);
        assert.partialDeepStrictEqual(events[0], {
            event_type: const_auth_event.change_me_email_not_authorized,
            event_status: const_auth_event_status.failure,
        });
    });

});
