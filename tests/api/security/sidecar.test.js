const assert = require('assert');
const axios = require('axios');
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


    describe('path scope from the original URI', function () {

        beforeEach(function () {
            config.public_paths = ['/favicon.ico', '/lib/*'];
            config.optional_auth_paths = ['/landing/*'];
        });

        function sidecar(client, original_uri) {
            const headers = {'X-Original-URI': original_uri};
            if (client.cookies.size) {
                headers.Cookie = Array.from(client.cookies.values()).join('; ');
            }
            return axios.get('/auth/sidecar', {baseURL: config.public_url, headers, maxRedirects: 0, validateStatus: () => true});
        }

        it('admits a public path anonymously, without X-Auth-User', async function () {
            const r = await sidecar(this.client, 'http://app.test/lib/app.js');
            assert.strictEqual(r.status, 200);
            assert.strictEqual(r.headers['x-auth-user'], undefined);
        });

        it('admits an optional-auth path anonymously, without X-Auth-User', async function () {
            const r = await sidecar(this.client, '/landing/home');
            assert.strictEqual(r.status, 200);
            assert.strictEqual(r.headers['x-auth-user'], undefined);
        });

        it('sets X-Auth-User on an optional-auth path for a signed-in user', async function () {
            await this.sign_in({username: 'mocha', password: 'pass123'});
            const sess = await this.client.get_session();
            const r = await sidecar(this.client, '/landing/home');
            assert.strictEqual(r.status, 200);
            assert.strictEqual(r.headers['x-auth-user'], sess.user_uid);
        });

        it('omits X-Auth-User on a public path even for a signed-in user', async function () {
            await this.sign_in({username: 'mocha', password: 'pass123'});
            const r = await sidecar(this.client, '/lib/app.js');
            assert.strictEqual(r.status, 200);
            assert.strictEqual(r.headers['x-auth-user'], undefined);
        });

        it('rejects a traversal that resolves out of a public prefix', async function () {
            const r = await sidecar(this.client, '/lib/../admin');
            assert.strictEqual(r.status, 401);
        });

        it('still protects a private path when the original URI is present', async function () {
            const r = await sidecar(this.client, '/private/page');
            assert.strictEqual(r.status, 401);
        });

    });

});
