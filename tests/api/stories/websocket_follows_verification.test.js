const WebSocket = require('ws');
const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');

// See websocket_follows_verification.md.
describe('A WebSocket follows the account\'s verification, as HTTP does | stories', function () {

    beforeEach(function () {
        config.confirm_email.required = true;
        config.personal_access_tokens.enabled = true;
        config.websockets.enabled = true;
        config.websockets.recheck_seconds = 0.5;
    });

    async function open_ws(headers) {
        const socket = new WebSocket(config.public_url.replace(/^http/, 'ws') + '/realtime', {headers});
        const closed = new Promise(v => socket.on('close', v));
        await new Promise(function (resolve, reject) {
            socket.on('message', v => (JSON.parse(v.toString()).type === 'upstream_open') && resolve());
            socket.on('error', reject);
        });
        return {socket, closed};
    }

    function closes_within(ws, ms) {
        return Promise.race([ws.closed.then(() => true), new Promise(v => setTimeout(v, ms, false))]);
    }

    function session_headers(client) {
        return {Cookie: Array.from(client.cookies.values()).join('; '), Origin: config.public_url};
    }

    function confirm_anns_address(verified_at) {
        return db('user_identities').where({type: const_user_identity.email, value_normalized: 'ann@corp.test'}).update({verified_at});
    }

    it('opens the laptop\'s WebSocket once the address is confirmed elsewhere, and heals its snapshot', async function () {
        await this.sign_in({email: 'ann@corp.test', password: 'anns-pass-123', verified: false});
        assert.strictEqual((await this.ws_roundtrip('/realtime', {headers: session_headers(this.client)})).opened, false);

        await confirm_anns_address(new Date());
        assert.strictEqual((await this.ws_roundtrip('/realtime', {headers: session_headers(this.client)})).opened, true);
        assert.ok((await this.client.get_session()).email_verified_at);
    });

    it('closes the open sockets, the session\'s and the token\'s, when the address stops being confirmed', async function () {
        await this.sign_in({email: 'ann@corp.test', password: 'anns-pass-123'});
        await this.mark_confirmed({reason: 'pat_create'});
        const {token} = await this.http_post_json('/auth/personal-access-tokens', {label: 'ws'});
        const by_session = await open_ws(session_headers(this.client));
        const by_token = await open_ws({Authorization: `Bearer ${token}`});
        try {
            assert.strictEqual(await closes_within(by_session, 1200), false);
            await confirm_anns_address(null);
            assert.strictEqual(await closes_within(by_session, 2500), true);
            assert.strictEqual(await closes_within(by_token, 2500), true);
        }
        finally {
            by_session.socket.terminate();
            by_token.socket.terminate();
        }
    });

});
