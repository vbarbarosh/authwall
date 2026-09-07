const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');

// The X-Auth-User trust boundary: the upstream must only ever see the identity
// header Authwall sets, never one a client smuggled in. The strip has to catch
// every spelling — Node keeps "X_Auth_User" as "x_auth_user", and upstreams
// that fold "_" onto "-" (PHP CGI/FPM, Apache mod_php) would read it as
// X-Auth-User. This is the exhaustive suite; the story-level check is
// tests/api/stories/identity_header_underscore_strip.test.js.
describe('inbound identity header strip', function () {

    describe('HTTP proxy', function () {

        it('replaces a dash-spelled X-Auth-User with the authenticated value', async function () {
            const {sess} = await this.signed_in_upstream({'X-Auth-User': 'dash-spoof'});
            assert.strictEqual(sess.upstream['x-auth-user'], sess.user_uid);
        });

        it('strips the underscore spelling X_Auth_User', async function () {
            const {sess} = await this.signed_in_upstream({'X-Auth-User': 'dash', 'X_Auth_User': 'underscore'});
            assert.strictEqual(sess.upstream['x-auth-user'], sess.user_uid);
            assert.strictEqual('x_auth_user' in sess.upstream, false);
        });

        it('strips every x-auth-* / x_auth_* variant, dash, underscore and mixed', async function () {
            const {sess} = await this.signed_in_upstream({
                'X-Auth-User': 'a',
                'X_Auth_User': 'b',
                'X-Auth-Role': 'c',
                'X_Auth_Role': 'd',
                'X-Auth_Groups': 'e',
                'X_Auth-Tenant': 'f',
                'x_auth_anything': 'g',
            });
            const upstream = sess.upstream;
            assert.strictEqual(upstream['x-auth-user'], sess.user_uid);
            for (const name of ['x_auth_user', 'x-auth-role', 'x_auth_role', 'x-auth_groups',
                                'x_auth-tenant', 'x_auth_anything']) {
                assert.strictEqual(name in upstream, false, `${name} reached the upstream`);
            }
        });

        it('does not over-strip an unrelated header that merely starts with x-auth', async function () {
            // "x-authenticated-user" folds to itself and does not start with
            // "x-auth-" (the seventh char is not a dash), so it is not an
            // identity header and must pass through untouched.
            const {sess} = await this.signed_in_upstream({'X-Authenticated-User': 'keep-me'});
            assert.strictEqual(sess.upstream['x-authenticated-user'], 'keep-me');
        });

        it('strips inbound identity headers on a public path, where no X-Auth-User is set', async function () {
            // Anonymous request to a public path is proxied without X-Auth-User,
            // but a client-supplied identity header must still be removed.
            const r = await axios.get('/favicon.ico', {
                baseURL: config.public_url,
                headers: {'X-Auth-User': 'anon-spoof', 'X_Auth_User': 'anon-spoof'},
                validateStatus: () => true,
            });
            const upstream = r.data.headers;
            assert.strictEqual('x-auth-user' in upstream, false);
            assert.strictEqual('x_auth_user' in upstream, false);
        });
    });

    describe('WebSocket upgrade', function () {
        beforeEach(function () {
            config.personal_access_tokens.enabled = true;
            config.websockets.enabled = true;
        });

        it('strips dash and underscore identity headers on a bearer upgrade', async function () {
            await this.sign_in({username: 'mocha', password: 'pass1234'});
            const sess = await this.client.get_session();
            const created = await this.http_post_json('/auth/personal-access-tokens', {label: 'ws'});

            const r = await this.ws_roundtrip('/realtime', {
                token: created.token,
                headers: {'X-Auth-User': 'dash', 'X_Auth_User': 'underscore', 'X_Auth_Role': 'role'},
            });
            assert.strictEqual(r.opened, true, r.error);
            assert.strictEqual(r.upstream_headers['x-auth-user'], sess.user_uid);
            assert.strictEqual('x_auth_user' in r.upstream_headers, false);
            assert.strictEqual('x_auth_role' in r.upstream_headers, false);
        });

        it('strips dash and underscore identity headers on a cookie-session upgrade', async function () {
            await this.sign_in({username: 'mocha', password: 'pass1234'});
            const sess = await this.client.get_session();
            const cookie = Array.from(this.client.cookies.values()).join('; ');

            const r = await this.ws_roundtrip(`/realtime?user=${sess.user_uid}`, {
                headers: {Cookie: cookie, Origin: config.public_url,
                          'X-Auth-User': 'dash', 'X_Auth_User': 'underscore'},
            });
            assert.strictEqual(r.opened, true, r.error);
            assert.strictEqual(r.upstream_headers['x-auth-user'], sess.user_uid);
            assert.strictEqual('x_auth_user' in r.upstream_headers, false);
        });
    });

    beforeEach(function () {
        this.signed_in_upstream = async function (headers) {
            await this.sign_in({username: 'mocha', password: 'pass1234'});
            const sess = await this.client.get_session();
            const cookie = Array.from(this.client.cookies.values()).join('; ');
            const r = await axios.get('/echo-me', {
                baseURL: config.public_url,
                headers: {Cookie: cookie, ...headers},
                validateStatus: () => true,
            });
            sess.upstream = r.data.headers;
            return {sess};
        };
    });
});
