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
const mock_google = require('../../mock_google');
const mock_github = require('../../mock_github');

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

        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.new_sign_in];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after successful sign-in using email and password', async function () {
        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass123'});

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.new_sign_in];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after successful sign-in using magick link', async function () {
        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        await this.http_get_json(this.sent_emails[0].placeholders.link);

        await this.wait_for_emails(2);
        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.magic_link, const_email.new_sign_in];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after successful sign-in using magick code', async function () {
        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: this.sent_emails[0].placeholders.code});

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.magic_link, const_email.new_sign_in];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after successful sign-in using Google', async function () {

        mock_google();

        await db.transaction(async function () {
            const now = new Date();
            const user = await users_create();
            await db('user_identities').insert({
                uid: random_uid_user_identity(),
                user_id: user.id,
                type: const_user_identity.oauth_google,
                value: 'google-user-123',
                value_normalized: 'google-user-123',
                created_at: now,
                updated_at: now,
                verified_at: now,
            });
            await db('user_identities').insert({
                uid: random_uid_user_identity(),
                user_id: user.id,
                type: const_user_identity.email,
                value: 'test@example.com',
                value_normalized: normalize_email('test@example.com'),
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

        mock_github();

        await db.transaction(async function () {
            const now = new Date();
            const user = await users_create();
            await db('user_identities').insert({
                uid: random_uid_user_identity(),
                user_id: user.id,
                type: const_user_identity.oauth_github,
                value: 'github-user-123',
                value_normalized: 'github-user-123',
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
            code: '4/fake_code',
            state: sess.oauth_state,
        }));

        await this.wait_for_emails(1);

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.new_sign_in];
        assert.deepStrictEqual(actual, expected);
    });

});
