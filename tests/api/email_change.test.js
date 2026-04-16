const assert = require('assert');

describe('GET /auth/email-change/confirm', function () {

    it('replaces the old email identity with the new one', async function () {
        const email = 'old@authwall.test';
        const new_email = 'new@authwall.test';
        const password = 'pass123';

        await this.add_user({email, password});

        await this.http_post_json('/auth/sign-in', {username: email, password});
        await this.http_post_json('/auth/email-change/request', {email: new_email});

        await this.http_get_json(this.sent_emails[1].placeholders.confirm_link);

        const status3 = await this.http_get_json('/auth/status');
        const actual = status3.providers.filter(v => v.type === 'email').map(v => v.value_normalized);

        assert.deepStrictEqual(actual, [new_email]);
    });

});
