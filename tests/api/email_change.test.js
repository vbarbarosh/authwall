const assert = require('assert');
const config = require('../../config');
const db = require('../../db');

describe('GET /auth/email-change/confirm', function () {

    it('replaces the old email identity with the new one', async function () {
        const email = 'old@authwall.test';
        const new_email = 'new@authwall.test';
        const password = 'pass123';

        await this.add_user({email, password});

        await this.http_post_json('/auth/sign-in', {username: email, password});
        await this.http_post_json('/auth/email-change/request', {email: new_email});

        await this.http_get_json(this.sent_emails[1].placeholders.confirm_link);

        const status = await this.http_get_json('/auth/status');
        const actual = status.providers.filter(v => v.type === 'email').map(v => v.value_normalized);

        assert.deepStrictEqual(actual, [new_email]);
    });

    it('rejects a new email outside the configured allowed domains', async function () {
        config.access.allowed_domains = ['authwall.test'];

        const email = 'old@authwall.test';
        const new_email = 'new@example.test';
        const password = 'pass123';

        await this.sign_in({email, password});
        await this.http_post_json('/auth/email-change/request', {email: new_email});

        const status = await this.http_get_json('/auth/status');
        const actual = status.providers.filter(v => v.type === 'email').map(v => v.value_normalized);
        const tokens = await db('email_change_tokens').where({email_normalized: new_email});

        assert.strictEqual(status.error, 'Email domain is not allowed');
        assert.deepStrictEqual(actual, [email]);
        assert.deepStrictEqual(tokens, []);
        assert.deepStrictEqual(this.sent_emails, []);
    });

});
