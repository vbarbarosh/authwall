const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');

// See verification_link_from_a_stranger.md.
describe('A stranger signs up with your address | stories', function () {

    beforeEach(function () {
        config.access.allowed_domains = ['corp.test'];
        config.confirm_email.required = true;
    });

    function app_get(path, cookies) {
        const headers = cookies.size ? {Cookie: Array.from(cookies.values()).join('; ')} : {};
        return axios.get(path, {baseURL: config.public_url, headers, maxRedirects: 0, validateStatus: () => true});
    }

    it('Vera\'s tap ends the stranger\'s session and password, and the account becomes hers', async function () {
        await this.http_post_json('/auth/sign-up', {email: 'victim@corp.test', password: 'strangers-pass', password_confirm: 'strangers-pass'});
        await this.wait_for_emails(1);
        const stranger = new Map(this.client.cookies);
        const {link} = this.sent_emails.find(v => v.placeholders?.link).placeholders;

        // Vera's phone: no session there.
        this.client.cookies.clear();
        const tap = await this.client.get_json_no_redirects(new URL(link).pathname + new URL(link).search);
        assert.match(tap.headers.location, /^\/auth\/password-reset\/confirm\?token=/);

        // The stranger's browser is out, and the stranger's password no longer signs in.
        const after = await app_get('/private/data', stranger);
        assert.strictEqual(after.status, 302);
        assert.match(after.headers.location, /^\/auth\/sign-in\?/);
        await this.http_post_json('/auth/sign-in', {username: 'victim@corp.test', password: 'strangers-pass'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: false, error: 'Invalid username or password'});

        // Vera sets her own password and signs in.
        const token = new URL(tap.headers.location, config.public_url).searchParams.get('token');
        await this.http_post_json('/auth/password-reset/confirm', {token, password: 'veras-pass', password_confirm: 'veras-pass'});
        await this.http_post_json('/auth/sign-in', {username: 'victim@corp.test', password: 'veras-pass'});
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);
    });

});
