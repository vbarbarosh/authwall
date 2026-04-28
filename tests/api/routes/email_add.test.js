const assert = require('assert');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');

describe('POST /auth/email/add', function () {

    it('adds an unverified email identity and sends verification', async function () {
        const email = 'new@authwall.test';

        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/email/add', {email});
        await this.wait_for_emails(1);

        assert.strictEqual(this.sent_emails[0].to, email);

        const status = await this.http_get_json('/auth/status');
        const actual = status.providers.filter(v => v.type === const_user_identity.email);

        assert.strictEqual(this.sent_emails.length, 1);
        assert.strictEqual(actual.length, 1);
        assert.strictEqual(actual[0].value_normalized, email);
        assert.strictEqual(actual[0].verified_at, null);

        await this.http_get_json(this.sent_emails[0].placeholders.link);

        const status2 = await this.http_get_json('/auth/status');
        const actual2 = status2.providers.filter(v => v.type === const_user_identity.email);
        assert.ok(actual2[0].verified_at);
    });

    it('fails when the user already has an email identity', async function () {
        await this.sign_in({username: 'mocha', email: 'old@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/email/add', {email: 'new@authwall.test'});

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Email already connected');
        assert.strictEqual(status.providers.filter(v => v.type === const_user_identity.email).length, 1);
    });

});
