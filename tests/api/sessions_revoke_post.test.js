const assert = require('assert');

describe('POST /auth/sessions/revoke', function () {

    it('revokes another session', async function () {
        const {user_id} = await this.add_user({username: 'mocha', password: 'pass123'});

        const cookies_a = new Map();
        const cookies_b = new Map();

        this.client.cookies = cookies_a;
        const s_a = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: s_a.csrf_token});

        this.client.cookies = cookies_b;
        const s_b = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: s_b.csrf_token});

        // From client A, revoke client B's session
        this.client.cookies = cookies_a;
        const status = await this.http_get_json('/auth/status');
        const session_b = await (async () => { this.client.cookies = cookies_b; const s = await this.client.get_session(); this.client.cookies = cookies_a; return s; })();
        await this.client.post_json('/auth/sessions/revoke', {uid: session_b.uid, _csrf: status.csrf_token});

        const status_a = await this.http_get_json('/auth/status');
        assert.strictEqual(status_a.authenticated, true);

        this.client.cookies = cookies_b;
        const status_b = await this.http_get_json('/auth/status');
        assert.strictEqual(status_b.authenticated, false);
    });

    it('fails when revoking current session', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        const sess = await this.client.get_session();
        await this.client.post_json('/auth/sessions/revoke', {uid: sess.uid, _csrf: status.csrf_token});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Cannot revoke current session');
        assert.strictEqual(status2.authenticated, true);
    });

    it('fails with missing uid', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/sessions/revoke', {_csrf: status.csrf_token});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Missing session uid');
    });

    it('requires authentication', async function () {
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/sessions/revoke', {uid: 'some-uid', _csrf: status.csrf_token});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Authentication required');
    });

});
