const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');

// See return_to_a_subdomain.md.
describe('A sign-in sends you back to a subdomain, and the landing loads once | stories', function () {

    // As the SPA posts: the session's cookie and token, and the header that
    // asks for the landing instead of the redirect.
    async function post_as_the_spa(ctx, url, data, headers = {'X-Authwall-Landing': 'ask'}) {
        const {csrf_token} = await ctx.http_get_json('/auth/status');
        return axios.post(url, {...data, _csrf: csrf_token}, {
            baseURL: ctx.client_base_url,
            headers: {Cookie: Array.from(ctx.client.cookies.values()).join('; '), ...headers},
            maxRedirects: 0,
            validateStatus: () => true,
        });
    }

    it('answers the SPA\'s sign-up with its subdomain landing, and a browser form with the redirect', async function () {
        this.client_base_url = config.public_url;
        config.public_url = 'http://corp.test';
        const sign_up = {username: 'ann', password: 'anns-pass-123', password_confirm: 'anns-pass-123'};

        const asked = await post_as_the_spa(this, '/auth/sign-up?return=http://wiki.corp.test/page', sign_up);
        assert.strictEqual(asked.status, 200);
        assert.deepStrictEqual(asked.data, {next: 'http://wiki.corp.test/page'});

        this.client.cookies.clear();
        const form = await post_as_the_spa(this, '/auth/sign-up?return=http://wiki.corp.test/page', {...sign_up, username: 'bob'}, {});
        assert.strictEqual(form.status, 302);
        assert.strictEqual(form.headers.location, 'http://wiki.corp.test/page');
    });

    it('lands a return to another site on /', async function () {
        this.client_base_url = config.public_url;
        config.public_url = 'http://corp.test';
        const asked = await post_as_the_spa(this, '/auth/sign-up?return=http://evil.test/page', {username: 'ann', password: 'anns-pass-123', password_confirm: 'anns-pass-123'});
        assert.deepStrictEqual(asked.data, {next: '/'});
    });

    it('answers a failed post with the page it came from, the error in the session', async function () {
        this.client_base_url = config.public_url;
        const asked = await post_as_the_spa(this, '/auth/sign-up', {username: 'ann', password: 'anns-pass-123', password_confirm: 'another-pass'});
        assert.strictEqual(asked.status, 200);
        assert.deepStrictEqual(asked.data, {next: config.pages.sign_in});
        assert.ok((await this.http_get_json('/auth/status')).error);
    });

    it('lets the sign-in form through to the public host\'s subdomains', async function () {
        this.client_base_url = config.public_url;
        config.public_url = 'https://corp.test';
        const r = await axios.get('/auth/sign-in', {baseURL: this.client_base_url, validateStatus: () => true});
        assert.match(r.headers['content-security-policy'], /(^|; )form-action 'self' https:\/\/\*\.corp\.test:\*(;|$)/);
        assert.match(r.headers['content-security-policy'], /(^|; )connect-src 'self'(;|$)/);
    });

});
