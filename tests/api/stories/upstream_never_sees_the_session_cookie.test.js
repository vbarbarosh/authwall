const assert = require('assert');
const config = require('../../../config');
const cookie_signature = require('cookie-signature');

// See upstream_never_sees_the_session_cookie.md.
describe('The app behind Authwall never sees its session cookie | stories', function () {

    beforeEach(function () {
        config.websockets.enabled = true;
    });

    // A cookie Authwall signed with its own secret, under the old name.
    function legacy_cookie(sid) {
        return `connect.sid=${encodeURIComponent('s:' + cookie_signature.sign(sid, config.secrets.express_session))}`;
    }

    for (const mode of ['proxy', 'direct']) {
        it(`a signed-in request reaches the app with the app's cookies only, in ${mode} mode`, async function () {
            config.upstream.mode = mode;
            await this.sign_in({username: 'mocha', password: 'pass1234'});
            this.client.cookies.set('app', 'app=1');

            const upstream = await this.http_get_json('/private/page');
            assert.match(upstream.headers['x-auth-user'], /^awuser_/);
            assert.strictEqual(upstream.headers.cookie, 'app=1');
        });
    }

    it('a connect.sid Authwall signed before the rename is dropped; the app\'s own connect.sid passes', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});

        this.client.cookies.set('connect.sid', legacy_cookie('awsess_left_from_1_16'));
        assert.strictEqual((await this.http_get_json('/private/page')).headers.cookie, undefined);

        this.client.cookies.set('connect.sid', 'connect.sid=s%3Athe-apps-own.signature');
        assert.strictEqual((await this.http_get_json('/private/page')).headers.cookie, 'connect.sid=s%3Athe-apps-own.signature');
    });

    it('a WebSocket reaches the app with the app\'s cookies only', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const cookie = [...this.client.cookies.values(), 'app=1'].join('; ');

        const r = await this.ws_roundtrip('/realtime', {headers: {Cookie: cookie, Origin: config.public_url}});
        assert.strictEqual(r.opened, true, r.error);
        assert.strictEqual(r.upstream_headers.cookie, 'app=1');
    });

    it('a browser still holding the old session cookie signs in once', async function () {
        const {user_id} = await this.sign_in({username: 'mocha', password: 'pass1234'});
        const {uid} = await this.client.get_session();
        assert.ok(user_id);

        this.client.cookies.clear();
        this.client.cookies.set('connect.sid', legacy_cookie(uid));
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, false);
    });

});
