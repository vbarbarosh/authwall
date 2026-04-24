const assert = require('assert');
const config = require('../../config');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('GET /auth/facebook', function () {

    beforeEach(function () {
        config.flows.facebook.enabled = true;
        config.flows.facebook.client_id = 'mocha_facebook_client_id';
        config.flows.facebook.redirect_url = 'mocha_facebook_redirect_url';
    });

    afterEach(function () {
        config.flows.facebook.enabled = false;
    });

    it('redirects to facebook oauth with login intent', async function () {
        const r = await this.client.get_json_no_redirects('/auth/facebook');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, urlmod('https://www.facebook.com/v22.0/dialog/oauth', {
            client_id: 'mocha_facebook_client_id',
            redirect_uri: 'mocha_facebook_redirect_url',
            response_type: 'code',
            scope: 'email',
            state: sess.oauth_state,
        }));
    });

    it('redirects to facebook oauth with connect intent', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const r = await this.client.get_json_no_redirects('/auth/facebook?connect=1');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        const location = new URL(r.headers.location);
        assert.strictEqual(location.origin + location.pathname, 'https://www.facebook.com/v22.0/dialog/oauth');
        assert.strictEqual(location.searchParams.get('state'), sess.oauth_state);
        assert.notStrictEqual(sess.oauth_state, null);
    });

});
