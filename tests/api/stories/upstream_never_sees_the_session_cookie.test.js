const assert = require('assert');
const config = require('../../../config');
const cookie_signature = require('cookie-signature');
const db = require('../../../db');
const end_every_session = require('../../../db/migrations/20261119040000_sessions__end_every_session');

// See upstream_never_sees_the_session_cookie.md.
describe('The app behind Authwall never sees its session cookie | stories', function () {

    beforeEach(function () {
        config.websockets.enabled = true;
    });

    // A session id as Authwall signs it with its own secret.
    function signed(sid) {
        return encodeURIComponent('s:' + cookie_signature.sign(sid, config.secrets.express_session));
    }

    // A cookie Authwall signed, under the old name.
    function legacy_cookie(sid) {
        return `connect.sid=${signed(sid)}`;
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

    it('a session from before the rename ends at the upgrade: its old value under the new name signs in no more (AW-19)', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const {uid} = await this.client.get_session();
        // A session row knows no cookie name: one made under connect.sid
        // before 1.17 signs in the same way, its value sent as authwall.sid.
        this.client.cookies.clear();
        this.client.cookies.set('authwall.sid', `authwall.sid=${signed(uid)}`);
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);

        await end_every_session.up(db);
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, false);
    });

});
