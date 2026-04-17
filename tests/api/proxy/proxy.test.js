const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');

describe('proxy', function () {

    beforeEach(function () {
        config.public_paths = ['/terms.html', '/custom/public/path'];
    });

    it('public url has no x-auth-* headers at upstream', async function () {
        const r = await axios.get(`${config.public_url}/terms.html`);
        const auth_headers = Object.keys(r.headers).filter(v => v.startsWith('x-auth-'));
        assert.partialDeepStrictEqual(r.data, {echo_server: 'authwall_testing_echo_server'});
        assert.deepStrictEqual(auth_headers, []);
    });

    it('public url has no x-auth-* headers at upstream even when signed in', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const r = await this.http_get_json('/terms.html');
        const auth_headers = Object.keys(r.headers).filter(v => v.startsWith('x-auth-'));
        assert.partialDeepStrictEqual(r, {echo_server: 'authwall_testing_echo_server'});
        assert.deepStrictEqual(auth_headers, []);
    });

    it('public url strips spoofed x-auth-* headers', async function () {
        const r = await axios.get('/custom/public/path', {
            baseURL: config.public_url,
            headers: {
                'x-auth-user': 'spoofed',
                'x-auth-token': 'spoofed',
            },
            maxRedirects: 0,
            validateStatus: v => v < 400,
        });
        const auth_headers = Object.keys(r.data.headers).filter(v => v.startsWith('x-auth-'));
        assert.partialDeepStrictEqual(r.data, {echo_server: 'authwall_testing_echo_server'});
        assert.deepStrictEqual(auth_headers, []);
    });

    it('auth url has x-auth-user header at upstream when signed in', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const sess = await this.client.get_session();
        assert.partialDeepStrictEqual(await this.http_get_json('/private'), {
            echo_server: 'authwall_testing_echo_server',
            method: 'GET',
            url: '/private',
            headers: {
                'x-auth-user': sess.user_uid,
            },
        });
        assert.partialDeepStrictEqual(await this.http_post_json('/private'), {
            echo_server: 'authwall_testing_echo_server',
            method: 'POST',
            url: '/private',
            headers: {
                'x-auth-user': sess.user_uid,
            },
        });
    });

    it('auth url replaces spoofed x-auth-user with value from session', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const sess = await this.client.get_session();
        const r = await axios.post('/private', {num: 123}, {
            baseURL: config.public_url,
            headers: {
                'custom-header': '12345',
                'x-auth-user': 'spoofed-value',
                Cookie: Array.from(this.client.cookies.values()).join('; '),
            },
            maxRedirects: 0,
            validateStatus: v => v < 400,
        });
        assert.partialDeepStrictEqual(r.data, {
            echo_server: 'authwall_testing_echo_server',
            method: 'POST',
            url: '/private',
            headers: {
                'custom-header': '12345',
                'x-auth-user': sess.user_uid,
            },
            body: JSON.stringify({num: 123}),
        });
    });

});
