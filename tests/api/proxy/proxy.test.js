const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('proxy', function () {

    beforeEach(function () {
        config.public_paths = ['/terms.html', '/custom/public/path', '/lib/*', '/designs/*'];
        config.optional_auth_paths = ['/', '/landing/*'];
        config.upstream.set_headers = [];
        config.upstream.unset_headers = [];
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

    it('public url prefix reaches upstream without a session', async function () {
        const r = await axios.get('/lib/app.js', {
            baseURL: config.public_url,
            maxRedirects: 0,
            validateStatus: v => v < 400,
        });
        const auth_headers = Object.keys(r.data.headers).filter(v => v.startsWith('x-auth-'));
        assert.partialDeepStrictEqual(r.data, {
            echo_server: 'authwall_testing_echo_server',
            url: '/lib/app.js',
        });
        assert.deepStrictEqual(auth_headers, []);
    });

    it('public url prefix has no x-auth-* headers at upstream even when signed in', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const r = await this.http_get_json('/designs/main.css');
        const auth_headers = Object.keys(r.headers).filter(v => v.startsWith('x-auth-'));
        assert.partialDeepStrictEqual(r, {
            echo_server: 'authwall_testing_echo_server',
            url: '/designs/main.css',
        });
        assert.deepStrictEqual(auth_headers, []);
    });

    it('optional auth url reaches upstream without a session and without x-auth-* headers', async function () {
        const r = await axios.get('/landing/home', {
            baseURL: config.public_url,
            maxRedirects: 0,
            validateStatus: v => v < 400,
        });
        const auth_headers = Object.keys(r.data.headers).filter(v => v.startsWith('x-auth-'));
        assert.partialDeepStrictEqual(r.data, {
            echo_server: 'authwall_testing_echo_server',
            url: '/landing/home',
        });
        assert.deepStrictEqual(auth_headers, []);
    });

    it('optional auth url has x-auth-user header at upstream when signed in', async function () {
        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const sess = await this.client.get_session();
        assert.partialDeepStrictEqual(await this.http_get_json('/landing/home'), {
            echo_server: 'authwall_testing_echo_server',
            url: '/landing/home',
            headers: {
                'x-auth-user': sess.user_uid,
            },
        });
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

    it('auth url redirects to email verification when enforcement requires it', async function () {
        config.confirm_email.required = true;

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass1234', verified: false});
        const res = await this.client.get_json_no_redirects('/private');

        assert.strictEqual(res.status, 302);
        assert.strictEqual(res.headers.location, urlmod(config.pages.email_verify_request, {return: '/private'}));
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Email verification required',
        });
    });

    it('auth url reaches upstream when enforced email is verified', async function () {
        config.confirm_email.required = true;

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass1234', verified: true});
        const sess = await this.client.get_session();

        assert.partialDeepStrictEqual(await this.http_get_json('/private'), {
            echo_server: 'authwall_testing_echo_server',
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

    it('auth url adds configured upstream headers after authwall headers', async function () {
        config.upstream.set_headers = [
            {name: 'X-Team', value: 'notes'},
            {name: 'X-Env', value: 'prod'},
        ];

        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const sess = await this.client.get_session();
        assert.partialDeepStrictEqual(await this.http_get_json('/private'), {
            echo_server: 'authwall_testing_echo_server',
            headers: {
                'x-auth-user': sess.user_uid,
                'x-team': 'notes',
                'x-env': 'prod',
            },
        });
    });

    it('auth url can set an empty upstream header value', async function () {
        config.upstream.set_headers = [
            {name: 'X-Empty', value: ''},
            {name: 'X-Team', value: 'notes'},
        ];

        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const sess = await this.client.get_session();
        assert.partialDeepStrictEqual(await this.http_get_json('/private'), {
            echo_server: 'authwall_testing_echo_server',
            headers: {
                'x-auth-user': sess.user_uid,
                'x-empty': '',
                'x-team': 'notes',
            },
        });
    });

    it('auth url can remove x-auth-user with configured unset headers', async function () {
        config.upstream.set_headers = [
            {name: 'X-Team', value: 'notes'},
        ];
        config.upstream.unset_headers = ['X-Auth-User'];

        await this.sign_in({username: 'mocha', password: 'pass1234'});
        const r = await this.http_get_json('/private');
        const auth_headers = Object.keys(r.headers).filter(v => v.startsWith('x-auth-'));

        assert.partialDeepStrictEqual(r, {
            echo_server: 'authwall_testing_echo_server',
            headers: {
                'x-team': 'notes',
            },
        });
        assert.deepStrictEqual(auth_headers, []);
    });

});
