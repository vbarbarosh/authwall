const assert = require('assert');
const config = require('../../../config');

// /auth/sidecar is the auth check for nginx `auth_request` / Caddy
// `forward_auth` deployments: on 200 the reverse proxy copies X-Auth-User onto
// the upstream request. It must not admit anyone the HTTP proxy path rejects.
describe('sidecar authorization', function () {

    it('returns X-Auth-User for a verified user', async function () {
        config.confirm_email.required = true;

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: true});

        const sidecar = await this.client.get_json_no_redirects('/auth/sidecar');
        assert.strictEqual(sidecar.status, 200);
        assert.ok(sidecar.headers['x-auth-user']);
    });

    it('rejects an unverified user, matching the proxy path', async function () {
        config.confirm_email.required = true;

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});

        // The proxy path holds this user at email verification...
        const proxied = await this.client.get_json_no_redirects('/some/protected/path');
        assert.strictEqual(proxied.status, 302);
        assert.match(proxied.headers.location, /^\/auth\/email-verify\?/);

        // ...so the sidecar check must reject them too.
        try {
            await this.client.get_json_no_redirects('/auth/sidecar');
        }
        catch (error) {
            assert.strictEqual(error.response.status, 403);
            assert.strictEqual(error.response.headers['x-auth-user'], undefined);
            return;
        }
        assert.ok(false, 'sidecar admitted an unverified user');
    });

    it('rejects an anonymous request', async function () {
        try {
            await this.client.get_json_no_redirects('/auth/sidecar');
        }
        catch (error) {
            assert.strictEqual(error.response.status, 401);
            assert.strictEqual(error.response.headers['x-auth-user'], undefined);
            return;
        }
        assert.ok(false, 'sidecar admitted an anonymous request');
    });

});
