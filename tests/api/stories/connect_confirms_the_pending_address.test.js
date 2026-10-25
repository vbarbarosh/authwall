const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See connect_confirms_the_pending_address.md.
describe('Connecting a provider confirms the account\'s pending address | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.client_secret = 'mocha_google_client_secret';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    afterEach(function () {
        nock.cleanAll();
    });

    async function connect_google(ctx, email) {
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {sub: 'google-ann', name: 'Ann', email, email_verified: true});
        await ctx.client.get_json_no_redirects('/auth/google?connect=1');
        const {oauth_state} = await ctx.client.get_session();
        await ctx.http_get_json(urlmod('/auth/google/callback', {code: 'fake_code', state: oauth_state}));
        return ctx.http_get_json('/auth/status');
    }

    async function connect_google_confirmed(ctx, email) {
        const {confirmation} = await connect_google(ctx, email);
        await ctx.mark_confirmed(confirmation);
        await connect_google(ctx, email);
    }

    function address_of(user_id, email) {
        return db('user_identities').where({user_id, type: const_user_identity.email, value_normalized: email}).first();
    }

    it('confirms ann@gmail.test, and makes it the primary, when Google vouches for it', async function () {
        const {user_id} = await this.sign_in({email: 'ann@gmail.test', password: 'anns-pass-123', verified: false});
        await connect_google_confirmed(this, 'ann@gmail.test');

        assert.ok(await db('user_identities').where({user_id, type: const_user_identity.oauth_google}).first());
        const address = await address_of(user_id, 'ann@gmail.test');
        assert.ok(address.verified_at);
        assert.ok(address.primary_at);
    });

    it('leaves the pending address as it was when Google returns another one', async function () {
        const {user_id} = await this.sign_in({email: 'ann@gmail.test', password: 'anns-pass-123', verified: false});
        await connect_google_confirmed(this, 'ann.work@gmail.test');

        assert.strictEqual((await address_of(user_id, 'ann@gmail.test')).verified_at, null);
        assert.ok((await address_of(user_id, 'ann.work@gmail.test')).verified_at);
    });

});
