const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// One-time credentials travel as query parameters, and every request is
// logged. A token that reaches a log file is a working sign-in credential for
// anyone who can read that file — an operator, a log shipper, or a backup.
describe('request log redaction', function () {

    it('does not log a magic-link token', async function () {
        config.flows.magic_link.enabled = true;
        config.mailer.enabled = true;

        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        await this.wait_for_emails(1);
        const {link} = this.sent_emails.find(v => v.placeholders?.link).placeholders;
        const token = new URL(link).searchParams.get('token');

        await this.client.get_json(urlmod(config.pages.magic_link_confirm, {token}));

        const logs = this.written_logs.join('\n');
        assert.strictEqual(logs.includes(token), false);
        assert.ok(logs.includes('/auth/magic-link/confirm?token=%5BFiltered%5D'));
    });

    it('does not log a token carried by the Referer header', async function () {
        const referer = `${config.public_url}/auth/password-reset/confirm?token=cf0bbd31074e5df6`;

        await axios.get('/auth/status', {baseURL: config.public_url, headers: {Referer: referer}});

        const logs = this.written_logs.join('\n');
        assert.strictEqual(logs.includes('cf0bbd31074e5df6'), false);
        assert.ok(logs.includes('/auth/password-reset/confirm?token=%5BFiltered%5D'));
    });

    it('still logs parameters that carry no credential', async function () {
        await this.client.get_json_no_redirects('/auth/sign-in?return=%2Fprofile');

        const logs = this.written_logs.join('\n');
        assert.ok(logs.includes('/auth/sign-in?return=%2Fprofile'));
    });

});

// The WebSocket upgrade logs (accept and reject) carry the request URL too, and
// an upgrade query can hold upstream credentials. It must go through the same
// redactor as HTTP request logging, and an attacker-supplied `user` value must
// not be able to break the single-line log format.
describe('websocket upgrade log redaction', function () {

    beforeEach(function () {
        config.personal_access_tokens.enabled = true;
        config.websockets.enabled = true;
    });

    it('redacts a token in the query on a rejected upgrade', async function () {
        const r = await this.ws_roundtrip('/realtime?token=WS_LOG_SECRET&user=x', {
            headers: {Authorization: 'Bearer awp_invalidxxxxxxxxxxxxxxxxxxxxxxxxxxxx'},
        });
        assert.strictEqual(r.opened, false);

        const logs = this.written_logs.join('\n');
        assert.strictEqual(logs.includes('WS_LOG_SECRET'), false);
        assert.ok(logs.includes('[ws_upgrade_reject]'));
        assert.ok(logs.includes('token=%5BFiltered%5D'));
    });

    it('redacts a credential in the query on an accepted upgrade', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const created = await this.http_post_json('/auth/personal-access-tokens', {label: 'ws'});

        const r = await this.ws_roundtrip('/realtime?code=WS_ACCEPT_SECRET', {token: created.token});
        assert.strictEqual(r.opened, true, r.error);

        const logs = this.written_logs.join('\n');
        assert.strictEqual(logs.includes('WS_ACCEPT_SECRET'), false);
        assert.ok(logs.includes('[ws_upgrade]'));
        assert.ok(logs.includes('code=%5BFiltered%5D'));
    });

    it('encodes an attacker-supplied requested_user so it cannot break the log line', async function () {
        const r = await this.ws_roundtrip('/realtime?user=evil%20injected', {
            headers: {Authorization: 'Bearer awp_invalidxxxxxxxxxxxxxxxxxxxxxxxxxxxx'},
        });
        assert.strictEqual(r.opened, false);

        const logs = this.written_logs.join('\n');
        assert.ok(logs.includes('requested_user="evil injected"'));
        assert.strictEqual(logs.includes('requested_user=evil injected'), false);
    });
});
