const assert = require('assert');
const config = require('../../config');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('error_handler', function () {

    beforeEach(function () {
        config.flows.github.enabled = true;
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    afterEach(function () {
        config.flows.github.enabled = false;
    });

    // GET /auth/email-verify/confirm without ?token throws UserFriendlyError('Missing token')
    // — a convenient way to trigger a user-facing error on a non-sign_in route.

    it('error on a non-sign_in route redirects to sign-in', async function () {
        assert.partialDeepStrictEqual(await this.client.get_json_no_redirects('/auth/email-verify/confirm'), {
            status: 302,
            headers: {
                location: config.pages.sign_in,
            },
        });
    });

    it('UserFriendlyError message is stored in session', async function () {
        await this.http_get_json('/auth/email-verify/confirm');
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Missing token',
        });
    });

    it('error on a non-sign_in route redirects authenticated user to profile', async function () {
        await this.sign_in({email: 'jonny@gmail.com', password: 'pass1234'});
        assert.partialDeepStrictEqual(await this.client.get_json_no_redirects('/auth/email-verify/confirm'), {
            status: 302,
            headers: {
                location: config.pages.profile,
            },
        });
    });

    it('non-UserFriendlyError stores generic message with req.uid', async function () {
        nock('https://github.com')
            .post('/login/oauth/access_token')
            .reply(400, {
                error: 'fake',
            });

        await this.http_get_json('/auth/status');  // initialize session
        await this.client.add_to_session({oauth_state: 'fake'});
        await this.http_get_json('/auth/github/callback?code=fake&state=fake');
        const status = await this.http_get_json('/auth/status');
        assert.match(status.error, /^An error occurred \[req_/);
    });

    it('POST /auth/sign-in failure redirects back to sign-in, not elsewhere', async function () {
        const r = await this.client.post_json_no_redirects('/auth/sign-in', {
            username: 'nobody',
            password: 'wrong',
        });
        assert.partialDeepStrictEqual(r, {
            status: 302,
            headers: {
                location: config.pages.sign_in,
            },
        });
    });

    it('POST /auth/sign-in failure preserves ?return query param', async function () {
        const status = await this.http_get_json('/auth/status');
        const r = await this.client.post_json_no_redirects(urlmod('/auth/sign-in', {return: '/some/path'}),
            {username: 'nobody', password: 'wrong', _csrf: status.csrf_token}
        );
        assert.partialDeepStrictEqual(r, {
            status: 302,
            headers: {
                location: urlmod(config.pages.sign_in, {return: '/some/path'}),
            },
        });
    });

});
