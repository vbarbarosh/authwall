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
        assert(this.written_logs.some(v => v.includes('[ws_upgrade_reject] reason=invalid_bearer_token')));
    });

    it('rejects an upgrade without a token', async function () {
        const r = await this.ws_roundtrip('/realtime', {});
        assert.strictEqual(r.opened, false);
        assert.strictEqual(r.status, 401);
        assert(this.written_logs.some(v => {
            return v.includes('[ws_upgrade_reject] reason=missing_session_cookie')
                && v.includes('cookie=missing');
        }));
    });

    it('proxies a browser session cookie-authenticated upgrade and forwards X-Auth-User', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const sess = await this.client.get_session();
        const r = await this.ws_roundtrip(`/realtime?user=${sess.user_uid}`, {
            headers: {
                Cookie: Array.from(this.client.cookies.values()).join('; '),
                Origin: config.public_url,
            },
        });
        assert.strictEqual(r.opened, true, r.error);
        assert.strictEqual(r.echo, 'ping');
        assert.strictEqual(r.upstream_headers['x-auth-user'], sess.user_uid);
        assert(this.written_logs.some(v => {
            return v.includes('[ws_upgrade]')
                && v.includes('auth=session')
                && v.includes(`requested_user=${sess.user_uid}`)
                && v.includes(`auth_user=${sess.user_uid}`);
        }));
    });

    it('accepts browser session cookie upgrades when personal access tokens are disabled', async function () {
        config.personal_access_tokens.enabled = false;
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const sess = await this.client.get_session();
        const r = await this.ws_roundtrip('/realtime', {
            headers: {
                Cookie: Array.from(this.client.cookies.values()).join('; '),
                Origin: config.public_url,
            },
        });
        assert.strictEqual(r.opened, true, r.error);
        assert.strictEqual(r.echo, 'ping');
        assert.strictEqual(r.upstream_headers['x-auth-user'], sess.user_uid);
    });

    it('rejects browser session cookie upgrades with a missing Origin header', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const r = await this.ws_roundtrip('/realtime', {
            headers: {
                Cookie: Array.from(this.client.cookies.values()).join('; '),
            },
        });
        assert.strictEqual(r.opened, false);
        assert.strictEqual(r.status, 401);
        assert(this.written_logs.some(v => {
            return v.includes('[ws_upgrade_reject] reason=missing_origin_header')
                && v.includes('cookie=connect_sid_present')
                && v.includes('origin=missing');
        }));
    });

    it('rejects browser session cookie upgrades with an invalid Origin header', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const r = await this.ws_roundtrip('/realtime', {
            headers: {
                Cookie: Array.from(this.client.cookies.values()).join('; '),
                Origin: 'not a url',
            },
        });
        assert.strictEqual(r.opened, false);
        assert.strictEqual(r.status, 401);
        assert(this.written_logs.some(v => {
            return v.includes('[ws_upgrade_reject] reason=invalid_origin_header')
                && v.includes('cookie=connect_sid_present')
                && v.includes('origin_value="not a url"');
        }));
    });

    it('rejects browser session cookie upgrades from a different Origin', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const expected_origin = new URL(config.public_url).origin;
        const r = await this.ws_roundtrip('/realtime', {
            headers: {
                Cookie: Array.from(this.client.cookies.values()).join('; '),
                Origin: 'https://evil.test',
            },
        });
        assert.strictEqual(r.opened, false);
        assert.strictEqual(r.status, 401);
        assert(this.written_logs.some(v => {
            return v.includes('[ws_upgrade_reject] reason=origin_mismatch')
                && v.includes('cookie=connect_sid_present')
                && v.includes(`origin_expected=${JSON.stringify(expected_origin)}`)
                && v.includes('origin_actual="https://evil.test"');
        }));
    });

    it('logs malformed session cookies on rejected browser-style upgrades', async function () {
        const r = await this.ws_roundtrip('/realtime?user=someone', {
            headers: {
                Cookie: 'connect.sid=not-signed',
                Origin: config.public_url,
            },
        });
        assert.strictEqual(r.opened, false);
        assert.strictEqual(r.status, 401);
        assert(this.written_logs.some(v => {
            return v.includes('[ws_upgrade_reject] reason=connect_sid_unsigned')
                && v.includes('cookie=connect_sid_unsigned')
                && v.includes('requested_user=someone');
        }));
    });

    it('logs bad session cookie signatures on rejected browser-style upgrades', async function () {
        const r = await this.ws_roundtrip('/realtime', {
            headers: {
                Cookie: 'connect.sid=s%3Aaw_sess_bad.bad-signature',
                Origin: config.public_url,
            },
        });
        assert.strictEqual(r.opened, false);
        assert.strictEqual(r.status, 401);
        assert(this.written_logs.some(v => {
            return v.includes('[ws_upgrade_reject] reason=connect_sid_bad_signature')
                && v.includes('cookie=connect_sid_present');
        }));
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
