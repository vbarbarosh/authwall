const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');

// See a_planted_cookie_behind_the_nginx_sidecar.md.
describe('A planted cookie behind the nginx sidecar | stories', function () {

    beforeEach(function () {
        config.public_paths = ['/robots.txt'];
    });

    // nginx's auth_request: the browser's Cookie header, and the path asked for.
    function sidecar(cookie, path) {
        return axios.get('/auth/sidecar', {baseURL: config.public_url, headers: {Cookie: cookie, 'X-Original-URI': `http://apps.test${path}`}, maxRedirects: 0, validateStatus: () => true});
    }

    async function bobs_cookie(ctx) {
        await ctx.sign_in({username: 'bob', password: 'bobs-pass-123'});
        // The pair as the browser sends it, authwall.sid=<value>.
        return ctx.client.cookies.get('authwall.sid');
    }

    it('refuses the session cookie twice, on a public path too (AW-131)', async function () {
        const cookie = await bobs_cookie(this);
        for (const path of ['/robots.txt', '/private/report']) {
            const r = await sidecar(`authwall.sid=planted; ${cookie}; theme=dark`, path);
            assert.strictEqual(r.status, 401, path);
            assert.strictEqual(r.headers['x-auth-user'], undefined, path);
        }
    });

    it('judges one session cookie as before', async function () {
        const cookie = await bobs_cookie(this);
        assert.strictEqual((await sidecar(`${cookie}; theme=dark`, '/robots.txt')).status, 200);
        const r = await sidecar(`${cookie}; theme=dark`, '/private/report');
        assert.strictEqual(r.status, 200);
        assert.match(r.headers['x-auth-user'], /^awuser_/);
        assert.strictEqual((await sidecar('theme=dark', '/robots.txt')).status, 200);
    });

});
