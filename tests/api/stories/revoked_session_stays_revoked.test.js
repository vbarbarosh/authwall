const assert = require('assert');
const config = require('../../../config');
const db = require('../../../db');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See revoked_session_stays_revoked.md.
describe('A revoked session stays revoked, whatever was in flight | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.client_secret = 'mocha_google_client_secret';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    afterEach(function () {
        nock.cleanAll();
    });

    it('keeps the laptop signed out when its slow request ends after the revocation', async function () {
        const {user_id} = await this.sign_in({username: 'ann', password: 'anns-pass-123'});
        await this.client.get_json_no_redirects('/auth/google?connect=1');
        const {uid, oauth_state} = await this.client.get_session();

        // Google answers after the revocation, and with an error.
        nock('https://oauth2.googleapis.com').post('/token').delay(400).reply(500, {error: 'slow'});
        const in_flight = this.http_get_json(urlmod('/auth/google/callback', {code: 'fake_code', state: oauth_state}));
        await new Promise(v => setTimeout(v, 100));
        await db('sessions').where({user_id}).delete();
        await in_flight;

        assert.strictEqual(await db('sessions').where({uid}).first(), undefined);
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, false);
    });

    it('still saves a session made in the request, however often, and one whose row is there', async function () {
        await this.sign_in({username: 'ann', password: 'anns-pass-123'});
        const {uid} = await this.client.get_session();
        await this.client.get_json_no_redirects('/auth/google?connect=1');
        assert.ok((await this.client.get_session()).oauth_state);
        assert.strictEqual((await this.client.get_session()).uid, uid);

        // A sign-in saves its new session, then the request saves it again.
        const {csrf_token} = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'ann', password: 'anns-pass-123', _csrf: csrf_token, return: '/auth/profile'});
        assert.deepStrictEqual(this.written_logs.filter(v => v.includes('UNIQUE constraint')), []);
    });

});
