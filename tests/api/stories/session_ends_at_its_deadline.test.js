const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');
const db = require('../../../db');

const DAY_MS = 24*60*60*1000;

// See session_ends_at_its_deadline.md.
describe('A session ends 30 days after sign-in, however often it is used | stories', function () {

    beforeEach(function () {
        config.personal_access_tokens.enabled = true;
        config.websockets.enabled = true;
    });

    // Ann signed in `days` ago; the row's expiry as an older Authwall left it, a month ahead.
    async function signed_in_days_ago(ctx, days) {
        await ctx.sign_in({username: 'ann', password: 'anns-pass-123'});
        const {uid} = await ctx.client.get_session();
        await db('sessions').where({uid}).update({created_at: new Date(Date.now() - days*DAY_MS), expires_at: new Date(Date.now() + 30*DAY_MS)});
        return uid;
    }

    function with_the_cookie(ctx, url, options = {}) {
        return axios({url, baseURL: config.public_url, headers: {Cookie: Array.from(ctx.client.cookies.values()).join('; ')}, maxRedirects: 0, validateStatus: () => true, ...options});
    }

    it('keeps the deadline where it was on a request on day 29', async function () {
        const uid = await signed_in_days_ago(this, 29);
        assert.strictEqual((await with_the_cookie(this, '/auth/status')).data.authenticated, true);
        const {created_at, expires_at} = await db('sessions').where({uid}).first();
        assert.ok(new Date(expires_at).getTime() <= new Date(created_at).getTime() + 30*DAY_MS);
    });

    it('signs out the first request past the deadline, a browser\'s or a script\'s', async function () {
        await signed_in_days_ago(this, 30.01);
        assert.strictEqual((await with_the_cookie(this, '/auth/status')).data.authenticated, false);
        assert.strictEqual((await with_the_cookie(this, '/private')).status, 302);
    });

    it('neither extends the deadline nor admits past it on a WebSocket', async function () {
        const uid = await signed_in_days_ago(this, 29);
        const headers = {Cookie: Array.from(this.client.cookies.values()).join('; '), Origin: config.public_url};
        assert.strictEqual((await this.ws_roundtrip('/realtime', {headers})).opened, true);
        const {created_at, expires_at} = await db('sessions').where({uid}).first();
        assert.ok(new Date(expires_at).getTime() <= new Date(created_at).getTime() + 30*DAY_MS);

        await db('sessions').where({uid}).update({created_at: new Date(Date.now() - 31*DAY_MS)});
        assert.strictEqual((await this.ws_roundtrip('/realtime', {headers})).opened, false);
    });

    it('re-issues a reloaded session\'s cookie with its deadline and its attributes', async function () {
        config.cookie.domain = 'corp.test';
        const uid = await signed_in_days_ago(this, 10);
        // A refused post saves the session's error: a change, so the cookie goes out again.
        const r = await with_the_cookie(this, '/auth/sessions/revoke', {method: 'post', data: {uid: 'nope', _csrf: 'wrong'}});
        const [set_cookie] = r.headers['set-cookie'];
        const {created_at} = await db('sessions').where({uid}).first();
        const expires = new Date(/Expires=([^;]+)/.exec(set_cookie)[1]).getTime();
        assert.ok(Math.abs(expires - (new Date(created_at).getTime() + 30*DAY_MS)) < 5000, set_cookie);
        for (const part of ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Domain=corp.test']) {
            assert.ok(set_cookie.includes(part), `${part} missing: ${set_cookie}`);
        }
    });

});
