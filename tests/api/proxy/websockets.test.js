const assert = require('assert');
const config = require('../../../config');

describe('websocket proxy', function () {

    beforeEach(function () {
        config.personal_access_tokens.enabled = true;
        config.websockets.enabled = true;
    });

    async function sign_in_with_token(_this, label = 'ws') {
        await _this.sign_in({username: 'mocha', password: 'pass1234'});
        const sess = await _this.client.get_session();
        const created = await _this.http_post_json('/auth/personal-access-tokens', {label});
        return {token: created.token, user_uid: sess.user_uid};
    }

    it('proxies an authenticated upgrade and forwards X-Auth-User', async function () {
        const {token, user_uid} = await sign_in_with_token(this);
        const r = await this.ws_roundtrip('/realtime', {token});
        assert.strictEqual(r.opened, true);
        assert.strictEqual(r.echo, 'ping');
        assert.strictEqual(r.upstream_headers['x-auth-user'], user_uid);
    });

    it('strips the client Authorization header before the upstream', async function () {
        const {token} = await sign_in_with_token(this);
        const r = await this.ws_roundtrip('/realtime', {token});
        assert.strictEqual('authorization' in r.upstream_headers, false);
    });

    it('overwrites a client-spoofed X-Auth-User with the authenticated value', async function () {
        const {token, user_uid} = await sign_in_with_token(this);
        const r = await this.ws_roundtrip('/realtime', {token, headers: {'X-Auth-User': 'spoofed'}});
        assert.strictEqual(r.upstream_headers['x-auth-user'], user_uid);
    });

    it('rejects an upgrade with an invalid token', async function () {
        const r = await this.ws_roundtrip('/realtime', {token: 'awp_invalid'});
        assert.strictEqual(r.opened, false);
        assert.strictEqual(r.status, 401);
    });

    it('rejects an upgrade without a token', async function () {
        const r = await this.ws_roundtrip('/realtime', {});
        assert.strictEqual(r.opened, false);
        assert.strictEqual(r.status, 401);
    });

    it('rejects an upgrade on an /auth path', async function () {
        const {token} = await sign_in_with_token(this);
        const r = await this.ws_roundtrip('/auth/anything', {token});
        assert.strictEqual(r.opened, false);
        assert.strictEqual(r.status, 404);
    });

    it('handles several concurrent connections sharing one PAT', async function () {
        const {token, user_uid} = await sign_in_with_token(this);
        const results = await Promise.all(Array.from({length: 5}, () => this.ws_roundtrip('/realtime', {token})));
        for (const r of results) {
            assert.strictEqual(r.opened, true, r.error);
            assert.strictEqual(r.echo, 'ping');
            assert.strictEqual(r.upstream_headers['x-auth-user'], user_uid);
        }
    });

    // Regression: with `ws: true` on the proxy, http-proxy-middleware self-subscribes
    // to the server 'upgrade' event on the first proxied HTTP request. From then on
    // Authwall's authenticated proxy.upgrade() is a no-op and the library's own
    // unauthenticated listener forwards upgrades without X-Auth-User — so every
    // WebSocket opened after the first HTTP request breaks at the upstream.
    it('keeps authenticating upgrades after a normal HTTP request flows through the proxy', async function () {
        const {token, user_uid} = await sign_in_with_token(this);

        // Works before any HTTP traffic.
        const before = await this.ws_roundtrip('/realtime', {token});
        assert.strictEqual(before.upstream_headers['x-auth-user'], user_uid);

        // A normal HTTP request through the proxy (would flip wsInternalSubscribed if ws:true).
        const http_res = await this.http_get_json('/some/page');
        assert.partialDeepStrictEqual(http_res, {echo_server: 'authwall_testing_echo_server'});

        // A later upgrade must still be authenticated and carry X-Auth-User.
        const after = await this.ws_roundtrip('/realtime', {token});
        assert.strictEqual(after.opened, true, after.error);
        assert.strictEqual(after.echo, 'ping');
        assert.strictEqual(after.upstream_headers['x-auth-user'], user_uid);

        // ...and an invalid token after the HTTP request must still be rejected (no auth bypass).
        const bad = await this.ws_roundtrip('/realtime', {token: 'awp_invalid'});
        assert.strictEqual(bad.opened, false);
        assert.strictEqual(bad.status, 401);
    });

});
