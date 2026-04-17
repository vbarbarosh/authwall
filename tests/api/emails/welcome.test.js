const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const mock_github = require('../../mock_github');
const mock_google = require('../../mock_google');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('emails • welcome', function () {

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

    it('should be sent after sign up via magic link', async function () {

        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        await this.http_get_json(this.sent_emails[0].placeholders.link);
        await this.wait_for_emails(2);

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.magic_link, const_email.welcome];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after sign up via magic code', async function () {

        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: this.sent_emails[0].placeholders.code});
        await this.wait_for_emails(2);

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.magic_link, const_email.welcome];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after Google login for the first time', async function () {

        mock_google();

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
        await this.wait_for_emails(1);

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.welcome];
        assert.deepStrictEqual(actual, expected);
    });

    it('should be sent after GitHub login for the first time', async function () {

        mock_github();

        await this.client.get_json_no_redirects('/auth/github');
        const sess = await this.client.get_session();

        await this.http_get_json(urlmod('/auth/github/callback', {
            code: '4/fake_code',
            state: sess.oauth_state,
        }));
        await this.wait_for_emails(1);

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.welcome];
        assert.deepStrictEqual(actual, expected);
    });

});
