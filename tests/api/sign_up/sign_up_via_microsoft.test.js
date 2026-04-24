const assert = require('assert');
const config = require('../../../config');
const mock_microsoft = require('../../mock_microsoft');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('sign up via microsoft | scenarios', function () {

    beforeEach(function () {
        config.flows.microsoft.enabled = true;
        config.flows.microsoft.client_id = 'mocha_microsoft_client_id';
        config.flows.microsoft.client_secret = 'mocha_microsoft_client_secret';
        config.flows.microsoft.redirect_url = 'mocha_microsoft_redirect_url';
        config.access.allowed_emails = [];
        config.access.allowed_domains = [];
        config.access.denied_emails = [];
        config.access.denied_domains = [];
        mock_microsoft();
    });

    afterEach(function () {
        config.flows.microsoft.enabled = false;
    });

    it('signup via microsoft should mark the email as verified', async function () {
        const r = await this.client.get_json_no_redirects('/auth/microsoft');
        const sess = await this.client.get_session();

        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, urlmod('https://login.microsoftonline.com/common/oauth2/v2.0/authorize', {
            client_id: 'mocha_microsoft_client_id',
            redirect_uri: 'mocha_microsoft_redirect_url',
            response_type: 'code',
            scope: 'openid email profile',
            prompt: 'select_account',
            state: sess.oauth_state,
        }));

        await this.http_get_json(urlmod('/auth/microsoft/callback', {
            state: sess.oauth_state,
            code: '4/fake_code',
        }));
        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
            display_name: 'Test User',
            avatar_url: null,
        });
        assert.ok(status.providers.find(v => v.type === 'oauth_microsoft' && v.value === 'microsoft-user-123').verified_at !== null);
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'test@example.com').verified_at !== null);
    });

});
