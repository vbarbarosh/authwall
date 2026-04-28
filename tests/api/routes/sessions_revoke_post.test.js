const assert = require('assert');

describe('POST /auth/sessions/revoke', function () {

    it('revokes another session', async function () {
        await this.add_user({username: 'mocha', password: 'pass123'});

        const cookies_a = new Map();
        const cookies_b = new Map();

        this.client.cookies = cookies_a;
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});

        this.client.cookies = cookies_b;
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});

        // From client A, revoke client B's session
        this.client.cookies = cookies_a;
        const session_b = await (async () => { this.client.cookies = cookies_b; const s = await this.client.get_session(); this.client.cookies = cookies_a; return s; })();
        await this.http_post_json('/auth/sessions/revoke', {uid: session_b.uid});

        const status_a = await this.http_get_json('/auth/status');
        assert.strictEqual(status_a.authenticated, true);

        this.client.cookies = cookies_b;
        const status_b = await this.http_get_json('/auth/status');
        assert.strictEqual(status_b.authenticated, false);
    });

    it('fails when revoking current session', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const sess = await this.client.get_session();
        await this.http_post_json('/auth/sessions/revoke', {uid: sess.uid});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Cannot revoke current session');
        assert.strictEqual(status2.authenticated, true);
    });

    it('fails with missing uid', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/sessions/revoke');
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Missing session uid');
    });

    it('requires authentication', async function () {
        await this.http_post_json('/auth/sessions/revoke', {uid: 'some-uid'});
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Authentication required');
    });

});
