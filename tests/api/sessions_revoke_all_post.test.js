const assert = require('assert');
const db = require('../../db');

describe('POST /auth/sessions/revoke-all', function () {

    it('revokes all other sessions', async function () {
        const {user_id} = await this.add_user({username: 'mocha', password: 'pass123'});

        const cookies_a = new Map();
        const cookies_b = new Map();

        // Sign in from two clients
        this.client.cookies = cookies_a;
        const s_a = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: s_a.csrf_token});

        this.client.cookies = cookies_b;
        const s_b = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: s_b.csrf_token});

        // Revoke all from client A
        this.client.cookies = cookies_a;
        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sessions/revoke-all', {_csrf: status.csrf_token});

        // Client A still authenticated
        const status_a = await this.http_get_json('/auth/status');
        assert.strictEqual(status_a.authenticated, true);
        assert.strictEqual(status_a.sessions.length, 1);

        // Client B is now invalid
        this.client.cookies = cookies_b;
        const status_b = await this.http_get_json('/auth/status');
        assert.strictEqual(status_b.authenticated, false);

        assert.deepStrictEqual(await db('sessions').where({user_id}).count('* as c'), [{c: 1}]);
    });

    it('keeps current session', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sessions/revoke-all', {_csrf: status.csrf_token});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

    it('requires authentication', async function () {
        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sessions/revoke-all', {_csrf: status.csrf_token});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Authentication required');
    });

});
