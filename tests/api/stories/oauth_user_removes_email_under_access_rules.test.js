const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

function mock_google({sub, email})
{
    nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, {access_token: 'fake-token'});

    nock('https://www.googleapis.com')
        .get('/oauth2/v3/userinfo')
        .reply(200, {sub, name: 'Google User', picture: null, email, email_verified: true});
}

async function sign_in_via_google(client, opts)
{
    mock_google(opts);
    await client.get_json_no_redirects('/auth/google');
    const sess = await client.get_session();
    await client.get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
}

// A verified address authorizes a username sign-in. An account with no
// username never puts that question to Authwall, so the access rules give it
// no reason to hold on to an address it does not sign in with.
describe('OAuth user removes their email under access rules | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.client_secret = 'mocha_google_client_secret';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.access.allowed_domains = ['authwall.test'];
        config.confirm_email.required = false;
    });

    it('removes the address and still signs in with google', async function () {
        await sign_in_via_google(this.client, {sub: 'google-jonny', email: 'jonny@authwall.test'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);
        const user_id = (await db('users').first()).id;
        assert.strictEqual((await db('user_identities').where({user_id, type: const_user_identity.email})).length, 1);

        await this.http_post_json('/auth/email/remove', {});

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null});
        assert.strictEqual((await db('user_identities').where({user_id, type: const_user_identity.email})).length, 0);

        await this.http_post_json('/auth/sign-out', {});
        await sign_in_via_google(this.client, {sub: 'google-jonny', email: 'jonny@authwall.test'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null});
        assert.strictEqual((await db('users')).length, 1);
    });

});
