const als = require('../../../src/helpers/als');
const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const db = require('../../../db');
const {mock} = require('node:test');

describe('POST /auth/magic-link/request', function () {

    afterEach(function () {
        mock.restoreAll();
    });

    it('sends magic link email', async function () {
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, false);

        assert.strictEqual(this.sent_emails.length, 1);
        assert.strictEqual(this.sent_emails[0].to, 'mocha@authwall.test');
        assert.strictEqual(this.sent_emails[0].name, const_email.magic_link);

        const row = await db('magic_links').where({email_normalized: 'mocha@authwall.test'}).first();
        assert.ok(row);
        assert.strictEqual(row.used_at, null);
    });

    it('rate-limits repeated requests', async function () {
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(this.sent_emails.length, 1);
    });

    it('fails with missing email', async function () {
        await this.http_post_json('/auth/magic-link/request');

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Missing email');
    });

    it('rejects input that is not an e-mail address', async function () {
        await this.http_post_json('/auth/magic-link/request', {email: 'invalid-email'});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid email');
        assert.strictEqual(this.sent_emails.length, 0);
    });

    it('shows a failed mail with sign-up open', async function () {
        mock.method(als.mailer, 'send', async function () {
            throw new Error('The mail service is down');
        });
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});

        const status2 = await this.http_get_json('/auth/status');
        assert.match(status2.error, /^An error occurred \[req_/);
    });

    it('logs a failed mail with sign-up closed, the notice unchanged', async function () {
        await this.add_user({email: 'verified@authwall.test'});
        config.sign_up.enabled = false;
        const failed = Promise.withResolvers();
        mock.method(als.mailer, 'send', async function () {
            failed.resolve();
            throw new Error('The mail service is down');
        });
        await this.http_post_json('/auth/magic-link/request', {email: 'verified@authwall.test'});
        await failed.promise;
        await new Promise(v => setImmediate(v));

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.ok(this.written_logs.some(v => String(v).includes('[complete_magic_link_request_error] "The mail service is down"')));
    });

});
