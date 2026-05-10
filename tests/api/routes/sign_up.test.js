const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');

describe('POST /auth/sign-up', function () {

    it('signs up with username and password', async function () {
        config.flows.password.min_password_length = 4;
        await this.http_post_json('/auth/sign-up', {username: 'mocha', password: 'pass1', password_confirm: 'pass1'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });
    });

    it('signs up with email and password', async function () {
        config.flows.password.min_password_length = 4;
        await this.http_post_json('/auth/sign-up', {email: 'mocha@authwall.test', password: 'pass1', password_confirm: 'pass1'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });
        assert.strictEqual(this.sent_emails[0].to, 'mocha@authwall.test');
        assert.strictEqual(this.sent_emails[0].name, const_email.welcome_and_confirm_email);
    });

    it('redirects email sign-up to verification notice when verification is enforced', async function () {
        config.confirm_email.required = true;
        config.flows.password.min_password_length = 4;

        const csrf_token = (await this.http_get_json('/auth/status')).csrf_token;
        const res = await this.client.post_json_no_redirects('/auth/sign-up', {
            _csrf: csrf_token,
            email: 'mocha@authwall.test',
            password: 'pass1',
            password_confirm: 'pass1',
        });

        assert.strictEqual(res.status, 302);
        assert.strictEqual(res.headers.location, config.pages.email_verify_notice);
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });
    });

    it('signs up with both email and username', async function () {
        config.flows.password.min_password_length = 4;
        await this.http_post_json('/auth/sign-up', {username: 'mocha', email: 'mocha@authwall.test', password: 'pass1', password_confirm: 'pass1'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });
        await this.wait_for_emails(1);
        assert.strictEqual(this.sent_emails[0].to, 'mocha@authwall.test');
        assert.strictEqual(this.sent_emails[0].name, const_email.welcome_and_confirm_email);
    });

    it('fails with missing fields', async function () {
        await this.http_post_json('/auth/sign-up');
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Missing fields',
            authenticated: false,
        });
    });

    it('fails when passwords do not match', async function () {
        await this.http_post_json('/auth/sign-up', {username: 'mocha', password: 'pass1', password_confirm: 'pass2'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Passwords do not match',
            authenticated: false,
        });
    });

    it('fails with invalid username', async function () {
        config.flows.password.min_password_length = 4;
        await this.http_post_json('/auth/sign-up', {username: '   ', password: 'pass1', password_confirm: 'pass1'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid username',
            authenticated: false,
        });
    });

    it('fails with invalid email', async function () {
        config.flows.password.min_password_length = 4;
        await this.http_post_json('/auth/sign-up', {email: '   ', password: 'pass1', password_confirm: 'pass1'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid email',
            authenticated: false,
        });
    });

    it('fails when username already exists', async function () {
        config.flows.password.min_password_length = 4;
        await this.add_user({username: 'mocha'});
        await this.http_post_json('/auth/sign-up', {username: 'mocha', password: 'pass1', password_confirm: 'pass1'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Username already exists',
            authenticated: false,
        });
    });

    it('fails when email already exists', async function () {
        config.flows.password.min_password_length = 4;
        await this.add_user({email: 'mocha@authwall.test'});
        await this.http_post_json('/auth/sign-up', {email: 'mocha@authwall.test', password: 'pass1', password_confirm: 'pass1'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Email already exists',
            authenticated: false,
        });
    });

});
