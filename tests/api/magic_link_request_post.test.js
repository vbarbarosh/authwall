const assert = require('assert');
const const_email = require('../../src/helpers/const/const_email');
const db = require('../../db');

describe('POST /auth/magic-link/request', function () {

    it('sends magic link email', async function () {
        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});

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
        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Magic link already sent. Please wait.');
        assert.strictEqual(this.sent_emails.length, 1);
    });

    it('fails with missing email', async function () {
        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/magic-link/request', {_csrf: status.csrf_token});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, 'Missing email');
    });

    it('accepts loosely formatted email input', async function () {
        const status = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/magic-link/request', {email: 'invalid-email', _csrf: status.csrf_token});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(this.sent_emails.length, 1);
        assert.strictEqual(this.sent_emails[0].to, 'invalid-email');
    });

});
