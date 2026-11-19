const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const nock = require('nock').default;
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See a_disconnect_leaves_a_way_in.md.
describe('A disconnect leaves a way in | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    // Bea signs up with Google, which gives no address, then adds one and
    // never confirms it.
    async function sign_up_and_add_an_address(ctx) {
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {sub: 'bea-google', name: 'Bea', picture: null, email: null, email_verified: false});
        await ctx.client.get_json_no_redirects('/auth/google');
        const {oauth_state} = await ctx.client.get_session();
        await ctx.client.get_json(urlmod('/auth/google/callback', {state: oauth_state, code: 'fake_code'}));

        await ctx.mark_confirmed({reason: 'email_add'});
        await ctx.http_post_json('/auth/email/add', {email: 'bea@authwall.test'});
        const status = await ctx.http_get_json('/auth/status');
        assert.deepStrictEqual(status.providers.map(v => [v.type, Boolean(v.verified_at)]).sort(), [['email', false], ['oauth_google', true]]);
    }

    it('refuses to leave only an unconfirmed address and no password (M-02)', async function () {
        await sign_up_and_add_an_address(this);

        await this.mark_confirmed({reason: 'provider_disconnect', disconnect: 'oauth_google'});
        await this.http_post_json('/auth/google/disconnect');

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Cannot disconnect Google: it is your only sign-in method');
        assert.ok(status.providers.find(v => v.type === 'oauth_google'));
    });

    it('lets an unconfirmed address with a password stay as the way in (M-02)', async function () {
        // Bea signed up with her address and a password, never confirmed
        // it, and has Google linked.
        const {user_id} = await this.sign_in({email: 'bea@authwall.test', password: 'bea-password', verified: false});
        const now = new Date();
        await db('user_identities').insert({uid: random_uid_user_identity(), user_id, type: const_user_identity.oauth_google, value: 'bea-google', value_normalized: 'bea-google', created_at: now, updated_at: now, verified_at: now});

        await this.mark_confirmed({reason: 'provider_disconnect', disconnect: 'oauth_google'});
        await this.http_post_json('/auth/google/disconnect');
        assert.strictEqual((await this.http_get_json('/auth/status')).error, null);

        await this.http_post_json('/auth/sign-out');
        await this.http_post_json('/auth/sign-in', {username: 'bea@authwall.test', password: 'bea-password'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null});
    });

});
