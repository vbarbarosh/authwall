const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const nock = require('nock');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('emails • github_connected', function () {

    beforeEach(function () {
        config.flows.github.enabled = true;
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    afterEach(function () {
        config.flows.github.enabled = false;
    });

    it('should be sent after connecting a GitHub account from profile', async function () {

        const userinfo = {
            id: 'github-user-123',
            name: 'Test User',
            avatar_url: 'https://example.com/avatar.jpg',
        };

        nock('https://github.com')
            .post('/login/oauth/access_token')
            .reply(200, {
                access_token: 'fake-token',
                expires_in: 28800,
                refresh_token: 'ghr_xxx',
                refresh_token_expires_in: 15811200,
                token_type: 'bearer',
                scope: 'user:email',
            });

        nock('https://api.github.com')
            .get('/user')
            .reply(200, userinfo);

        nock('https://api.github.com')
            .get('/user/emails')
            .reply(200, []);

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});

        await this.client.get_json_no_redirects('/auth/github?connect=1');
        const sess = await this.client.get_session();

        await this.client.get_json(urlmod('/auth/github/callback', {
            code: '4/fake_code',
            state: sess.oauth_state,
        }));
        await this.wait_for_emails(1);

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.github_connected];
        assert.deepStrictEqual(actual, expected);
    });

    it('should not be sent when GitHub is already connected', async function () {

        const userinfo = {
            id: 'github-user-123',
            name: 'Test User',
            avatar_url: 'https://example.com/avatar.jpg',
        };

        nock('https://github.com')
            .post('/login/oauth/access_token')
            .reply(200, {
                access_token: 'fake-token',
                expires_in: 28800,
                refresh_token: 'ghr_xxx',
                refresh_token_expires_in: 15811200,
                token_type: 'bearer',
                scope: 'user:email',
            });

        nock('https://api.github.com')
            .get('/user')
            .reply(200, userinfo);

        nock('https://api.github.com')
            .get('/user/emails')
            .reply(200, []);

        const {user_id} = await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});

        // Pre-link github account
        const now = new Date();
        await db('user_identities').insert({
            uid: random_uid_user_identity(),
            user_id,
            type: const_user_identity.oauth_github,
            value: userinfo.id,
            value_normalized: userinfo.id,
            created_at: now,
            updated_at: now,
            verified_at: now,
        });

        await this.client.get_json_no_redirects('/auth/github?connect=1');
        const sess = await this.client.get_session();

        await this.client.get_json(urlmod('/auth/github/callback', {
            code: '4/fake_code',
            state: sess.oauth_state,
        }));

        const actual = this.sent_emails.map(v => v.name);
        const expected = [];
        assert.deepStrictEqual(actual, expected);
    });

});
