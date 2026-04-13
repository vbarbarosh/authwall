const assert = require('assert');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('POST /auth/sign-in', function () {

    it('signs in with username and password', async function () {
        await this.add_user({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

    it('signs in with email and password', async function () {
        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass123', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
        assert.strictEqual(this.sent_emails[0].subject, 'New sign-in to your account');
    });

    it('redirects to the return url', async function () {
        await this.add_user({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        const r = await this.client.post_json_no_redirects(urlmod('/auth/sign-in', {return: 'https://foo.local.test'}), {username: 'mocha', password: 'pass123', _csrf: status.csrf_token});
        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, 'https://foo.local.test');
    });

    it('failure should redirect to the same url', async function () {
        await this.add_user({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        const r = await this.client.post_json_no_redirects(urlmod('/auth/sign-in', {return: 'https://foo.local.test'}), {username: 'mocha', password: 'pass12345', _csrf: status.csrf_token});
        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, urlmod('/auth/sign-in', {return: 'https://foo.local.test'}));
    });

    it('fails with missing fields', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {_csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Missing fields');
        assert.strictEqual(status2.authenticated, false);
    });

    it('fails with invalid username', async function () {
        await this.add_user({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'xxx', password: 'pass123', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid username or password');
        assert.strictEqual(status2.authenticated, false);
    });

    it('fails with invalid email', async function () {
        await this.add_user({username: 'mocha@authwall.test', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'xxx@authwall.test', password: 'pass123', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid username or password');
        assert.strictEqual(status2.authenticated, false);
    });

    it('fails with wrong password', async function () {
        await this.add_user({username: 'mocha', password: 'pass123'});
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'mocha', password: 'xxx', _csrf: status.csrf_token});
        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid username or password');
        assert.strictEqual(status2.authenticated, false);
    });

});
