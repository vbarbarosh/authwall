const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const nock = require('nock');
const normalize_email = require('../../../src/helpers/normalize/normalize_email');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const users_create = require('../../../src/helpers/models/users_create');

describe('emails • new_sign_in', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.github.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    afterEach(function () {
        config.flows.google.enabled = false;
        config.flows.github.enabled = false;
    });

    it('should be sent after successful sign-in using username and password', async function () {
        await this.add_user({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});

        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: status.csrf_token});

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.new_sign_in];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after successful sign-in using email and password', async function () {
        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});

        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass123', _csrf: status.csrf_token});

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.new_sign_in];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after successful sign-in using magick link', async function () {
        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});

        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});
        await this.http_get_json(this.sent_emails[0].placeholders.link);

        await this.wait_for_emails(2);
        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.magic_link, const_email.new_sign_in];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after successful sign-in using magick code', async function () {
        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});

        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: this.sent_emails[0].placeholders.code, _csrf: status.csrf_token});

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.magic_link, const_email.new_sign_in];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after successful sign-in using Google', async function () {

        const userinfo = {
            sub: 'google-user-123',
            name: 'Test User',
            picture: 'https://example.com/avatar.jpg',
            email: 'test@example.com',
            email_verified: true,
        };

        nock('https://oauth2.googleapis.com')
            .post('/token')
            .reply(200, {access_token: 'fake-token'});

        nock('https://www.googleapis.com')
            .get('/oauth2/v3/userinfo')
            .reply(200, userinfo);

        await db.transaction(async function () {
            const now = new Date();
            const user = await users_create();
            await db('user_identities').insert({
                uid: random_uid_user_identity(),
                user_id: user.id,
                type: const_user_identity.oauth_google,
                value: userinfo.sub,
                value_normalized: userinfo.sub,
                created_at: now,
                updated_at: now,
                verified_at: now,
            });
            await db('user_identities').insert({
                uid: random_uid_user_identity(),
                user_id: user.id,
                type: const_user_identity.email,
                value: userinfo.email,
                value_normalized: normalize_email(userinfo.email),
                created_at: now,
                updated_at: now,
                verified_at: now,
            });
        });

        await this.client.get_json_no_redirects('/auth/google');
        const sess = await this.client.get_session();

        await this.http_get_json(urlmod('/auth/google/callback', {
            state: sess.oauth_state,
            iss: 'https://accounts.google.com',
            code: '4/fake_code',
            scope: 'email profile https://www.googleapis.com/auth/userinfo.profile openid https://www.googleapis.com/auth/userinfo.email',
            authuser: '0',
            prompt: 'none'
        }));

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.new_sign_in];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after successful sign-in using GitHub', async function () {

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
            .reply(200, [
                {
                    email: 'jack@domain1.com',
                    primary: true,
                    verified: true,
                    visibility: 'public'
                },
                {
                    email: 'jack.m@domain2.com',
                    primary: false,
                    verified: true,
                    visibility: null
                },
                {
                    email: 'jj@domain3.com',
                    primary: false,
                    verified: true,
                    visibility: null
                }
            ]);

        await db.transaction(async function () {
            const now = new Date();
            const user = await users_create();
            await db('user_identities').insert({
                uid: random_uid_user_identity(),
                user_id: user.id,
                type: const_user_identity.oauth_github,
                value: userinfo.id,
                value_normalized: userinfo.id,
                created_at: now,
                updated_at: now,
                verified_at: now,
            });
            await db('user_identities').insert({
                uid: random_uid_user_identity(),
                user_id: user.id,
                type: const_user_identity.email,
                value: 'jack@domain1.com',
                value_normalized: normalize_email('jack@domain1.com'),
                created_at: now,
                updated_at: now,
                verified_at: now,
            });
        });

        await this.client.get_json_no_redirects('/auth/github');
        const sess = await this.client.get_session();

        await this.http_get_json(urlmod('/auth/github/callback', {
            code: "4/fake_code",
            state: sess.oauth_state,
        }));

        await this.wait_for_emails(1);

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.new_sign_in];
        assert.deepStrictEqual(actual, expected);
    });

});
