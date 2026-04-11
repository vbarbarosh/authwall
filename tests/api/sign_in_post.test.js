const assert = require('assert');

describe('POST /auth/sign-in', function () {

    it('signs in with username and password', async function () {
        await this.add_user({username: 'foo', password: 'foo'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'foo', password: 'foo', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

    it('signs in with email and password', async function () {
        await this.add_user({email: 'bar1@authwall.test', password: 'bar'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'bar1@authwall.test', password: 'bar', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
        assert.strictEqual(this.sent_emails[0].subject, 'New sign-in to your account');
    });

    it('redirects to the return url', async function () {
        await this.add_user({username: 'foo', password: 'foo'});
        const status = await this.client.get_json('/auth/status');
        const r = await this.client.post_json_no_redirects('/auth/sign-in?return=https://foo.local.test', {username: 'foo', password: 'foo', _csrf: status.csrf_token});
        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, 'https://foo.local.test');
    });

    it('failure should redirect to the same url', async function () {
        const status = await this.client.get_json('/auth/status');
        const r = await this.client.post_json_no_redirects('/auth/sign-in?return=https://foo.local.test', {username: 'foo', password: 'foo2', _csrf: status.csrf_token});
        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, '/auth/sign-in?return=https://foo.local.test');
    });

    it('fails with missing fields', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {_csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Missing fields');
        assert.strictEqual(status2.authenticated, false);
    });

    it('fails with invalid username', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'xxx', password: 'xxx', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid username or password');
        assert.strictEqual(status2.authenticated, false);
    });

    it('fails with invalid email', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'foo@bar.com', password: 'xxx', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid username or password');
        assert.strictEqual(status2.authenticated, false);
    });

    it('fails with wrong password', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'foo', password: 'xxx', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid username or password');
        assert.strictEqual(status2.authenticated, false);
    });

});
