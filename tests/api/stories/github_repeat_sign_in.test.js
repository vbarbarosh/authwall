const assert = require('assert');
const config = require('../../../config');
const nock = require('nock');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// GitHub returns the account id as a JSON number, not a string. It has to be
// normalized before it reaches the identity lookup, or a returning user is
// treated as brand new. See github_repeat_sign_in.md.
function mock_github(id)
{
    nock('https://github.com')
        .post('/login/oauth/access_token')
        .reply(200, {access_token: 'fake-token', token_type: 'bearer', scope: 'user:email'});

    nock('https://api.github.com')
        .get('/user')
        .reply(200, {id, name: 'GitHub User', avatar_url: null});

    nock('https://api.github.com')
        .get('/user/emails')
        .reply(200, []);
}

async function sign_in_via_github(client, id)
{
    mock_github(id);
    await client.get_json_no_redirects('/auth/github');
    const sess = await client.get_session();
    await client.get_json(urlmod('/auth/github/callback', {state: sess.oauth_state, code: 'fake_code'}));
}

describe('Repeat GitHub sign-in | stories', function () {

    beforeEach(function () {
        config.flows.github.enabled = true;
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    afterEach(function () {
        config.flows.github.enabled = false;
    });

    it('resolves to the same account when the provider id is a number', async function () {
        await sign_in_via_github(this.client, 583231);
        const first = await this.http_get_json('/auth/status');
        assert.strictEqual(first.authenticated, true);

        // Same GitHub account, fresh browser.
        this.client.cookies.clear();
        await sign_in_via_github(this.client, 583231);
        const second = await this.http_get_json('/auth/status');

        assert.strictEqual(second.error, null);
        assert.strictEqual(second.authenticated, true);
        assert.strictEqual(second.user_uid, first.user_uid);
    });

});
