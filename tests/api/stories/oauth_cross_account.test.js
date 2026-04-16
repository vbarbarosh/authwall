const assert = require('assert');
const config = require('../../../config');
const db = require('../../../db');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const nock = require('nock');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const users_create = require('../../../src/helpers/models/users_create');

// A signed-in user must not be able to connect an OAuth provider that is already
// linked to a different account — this would be an account takeover vector.
describe('OAuth connect blocked when provider belongs to another account | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    afterEach(function () {
        config.flows.google.enabled = false;
    });

    it('rejects Google connect when the Google account is already linked to another user', async function () {
        // Create user B in the DB with Google identity already linked
        const user_b = await users_create();
        const now = new Date();
        await db('user_identities').insert({
            uid: random_uid_user_identity(),
            user_id: user_b.id,
            type: const_user_identity.oauth_google,
            value: 'taken-google-sub',
            value_normalized: 'taken-google-sub',
            created_at: now,
            updated_at: now,
            verified_at: now,
        });

        // Sign in as user A (separate account)
        await this.sign_in({username: 'user-a', password: 'pass123'});

        // User A tries to connect the same Google account as user B
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {
            sub: 'taken-google-sub',
            name: 'User B',
            email: null,
            email_verified: false,
        });

        await this.http_get_json('/auth/google?connect=1');
        const sess = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Google account already linked to another user');
        // User A is still authenticated as themselves
        assert.strictEqual(status.authenticated, true);
        assert.strictEqual(status.providers.find(v => v.type === 'oauth_google'), undefined);
    });

});
