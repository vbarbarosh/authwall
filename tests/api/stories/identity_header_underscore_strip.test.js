const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');

// Story: identity_header_underscore_strip.md — a signed-in client attaches its
// own identity headers, in the dash and the underscore spelling, over the HTTP
// proxy and a WebSocket upgrade; the upstream must see only the value Authwall
// sets. The exhaustive variant lives in tests/api/security/identity_header_strip.test.js.
describe('story: an underscore identity header must not reach the upstream', function () {

    it('the upstream receives only Authwall\'s X-Auth-User over the HTTP proxy', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const sess = await this.client.get_session();

        const cookie = Array.from(this.client.cookies.values()).join('; ');
        const r = await axios.get('/echo-me', {
            baseURL: config.public_url,
            headers: {Cookie: cookie, 'X-Auth-User': 'somebody-else', 'X_Auth_User': 'somebody-else'},
            validateStatus: () => true,
        });
        const upstream = r.data.headers;
        assert.strictEqual(upstream['x-auth-user'], sess.user_uid);
        assert.strictEqual('x_auth_user' in upstream, false);
    });

    describe('over a WebSocket upgrade', function () {
        beforeEach(function () {
            config.personal_access_tokens.enabled = true;
            config.websockets.enabled = true;
        });

        it('the upstream receives only Authwall\'s X-Auth-User', async function () {
            await this.sign_in({username: 'mocha', password: 'pass1234'});
            const sess = await this.client.get_session();
            const created = await this.http_post_json('/auth/personal-access-tokens', {label: 'ws'});

            const r = await this.ws_roundtrip('/realtime', {
                token: created.token,
                headers: {'X-Auth-User': 'somebody-else', 'X_Auth_User': 'somebody-else'},
            });
            assert.strictEqual(r.opened, true, r.error);
            assert.strictEqual(r.upstream_headers['x-auth-user'], sess.user_uid);
            assert.strictEqual('x_auth_user' in r.upstream_headers, false);
        });
    });
});
