const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

function mock_google({sub = 'google-sub-123', email = 'shared@example.com'} = {})
{
    nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, {access_token: 'fake-token'});

    nock('https://www.googleapis.com')
        .get('/oauth2/v3/userinfo')
        .reply(200, {sub, name: 'Google User', picture: null, email, email_verified: true});
}

// OAuth login must not attach to an existing local account only because the
// provider returned the same email address.
describe('OAuth account linking by matching email is blocked | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    it('creates a separate Google user when the email belongs to an existing local account', async function () {
        const local = await this.add_user({email: 'shared@example.com', password: 'pass123'});
        const local_user = await db('users').where({id: local.user_id}).first();

        mock_google({sub: 'google-sub-same-email', email: 'shared@example.com'});
        await this.client.get_json_no_redirects('/auth/google');
        await this.http_get_json(urlmod('/auth/google/callback', {
            code: 'fake_code',
            state: await this.client.get_session().then(v => v.oauth_state),
        }));

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, null);
        assert.strictEqual(status.authenticated, true);
        assert.notStrictEqual(status.user_uid, local_user.uid);
        assert.ok(status.providers.find(v => v.type === const_user_identity.oauth_google && v.value === 'google-sub-same-email'));
        assert.strictEqual(status.providers.find(v => v.type === const_user_identity.email), undefined);

        const email_ident = await db('user_identities').where({
            type: const_user_identity.email,
            value_normalized: 'shared@example.com',
        }).first();
        const google_ident = await db('user_identities').where({
            type: const_user_identity.oauth_google,
            value_normalized: 'google-sub-same-email',
        }).first();

        assert.strictEqual(email_ident.user_id, local.user_id);
        assert.notStrictEqual(google_ident.user_id, local.user_id);
    });

});
