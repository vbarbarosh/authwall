const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');

// See a_sidecar_decision_is_never_cached.md.
describe('A sidecar decision is never cached | stories', function () {

    beforeEach(function () {
        config.public_paths = ['/lib/*'];
        config.optional_auth_paths = ['/landing/*'];
    });

    function sidecar(client, original_uri, cookie = null) {
        const headers = {'X-Original-URI': original_uri};
        if (cookie ?? client.cookies.size) {
            headers.Cookie = cookie ?? Array.from(client.cookies.values()).join('; ');
        }
        return axios.get('/auth/sidecar', {baseURL: config.public_url, headers, maxRedirects: 0, validateStatus: () => true});
    }

    it('says no-store on every decision (AW-172)', async function () {
        const answers = [
            ['anonymous, private', await sidecar(this.client, '/app')],
            ['anonymous, public', await sidecar(this.client, '/lib/app.js')],
            ['anonymous, optional', await sidecar(this.client, '/landing/home')],
        ];
        config.confirm_email.required = true;
        await this.sign_in({email: 'bea@corp.test', password: 'beas-pass', verified: false});
        answers.push(['unconfirmed', await sidecar(this.client, '/app')]);
        this.client.cookies.clear();
        await this.sign_in({email: 'ann@corp.test', password: 'anns-pass', verified: true});
        const signed_in = await sidecar(this.client, '/app');
        answers.push(['signed in', signed_in]);
        const cookie = Array.from(this.client.cookies.values()).join('; ');
        answers.push(['the cookie twice', await sidecar(this.client, '/lib/app.js', `${cookie}; ${cookie}`)]);

        assert.ok(signed_in.headers['x-auth-user']);
        assert.deepStrictEqual(answers.map(v => [v[0], v[1].status, v[1].headers['cache-control']]), [
            ['anonymous, private', 401, 'no-store'],
            ['anonymous, public', 200, 'no-store'],
            ['anonymous, optional', 200, 'no-store'],
            ['unconfirmed', 403, 'no-store'],
            ['signed in', 200, 'no-store'],
            ['the cookie twice', 401, 'no-store'],
        ]);
    });

});
