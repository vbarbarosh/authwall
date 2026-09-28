const assert = require('assert');
const config = require('../../../config');
const db = require('../../../db');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// AW-24: a second Google account, linked from a borrowed session, used to sit
// next to the owner's and outlive the owner's recovery.
describe('One account per provider | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    async function connect_google(ctx, sub) {
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {sub, name: 'Test User', picture: null, email: null, email_verified: false});
        await ctx.client.get_json_no_redirects('/auth/google?connect=1');
        const sess = await ctx.client.get_session();
        await ctx.http_get_json(urlmod('/auth/google/callback', {state: sess.oauth_state, code: 'fake_code'}));
        return ctx.http_get_json('/auth/status');
    }

    function identity_row(user_id, type, value) {
        const now = new Date();
        return {uid: `awident_${type}${value}`.slice(0, 32), user_id, type, value, value_normalized: value, created_at: now, updated_at: now, verified_at: now};
    }

    async function google_subs() {
        return db('user_identities').where({type: 'oauth_google'}).orderBy('id').pluck('value_normalized');
    }

    it('refuses to connect a second Google account', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        assert.strictEqual((await connect_google(this, 'owner-google')).error, null);

        const status = await connect_google(this, 'attacker-google');
        assert.strictEqual(status.error, 'A Google account is already connected; disconnect it first');
        assert.deepStrictEqual(await google_subs(), ['owner-google']);
        const event = await db('auth_events').where({event_type: 'identity_added', event_status: 'failure'}).first();
        assert.partialDeepStrictEqual(JSON.parse(event.custom), {reason: 'provider_already_connected'});
    });

    it('refuses a second Google account for one user in the database', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await connect_google(this, 'owner-google');
        const owner = await db('user_identities').where({value_normalized: 'owner-google'}).first();

        // A savepoint: on PostgreSQL a failed statement aborts the whole transaction.
        await assert.rejects(db.transaction(async function () {
            await db('user_identities').insert(identity_row(owner.user_id, 'oauth_google', 'attacker-google'));
        }));
        await db('user_identities').insert(identity_row(owner.user_id, 'oauth_github', 'owner-github'));
        assert.deepStrictEqual(await google_subs(), ['owner-google']);
    });

    it('still lets one user hold several email addresses', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        const ident = await db('user_identities').where({value_normalized: 'mocha@authwall.test'}).first();

        await db('user_identities').insert(identity_row(ident.user_id, 'email', 'second@authwall.test'));
        assert.strictEqual((await db('user_identities').where({user_id: ident.user_id, type: 'email'})).length, 2);
    });

});
