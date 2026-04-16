const assert = require('assert');

describe('sign up via magic link | scenarios', function () {

    it('signup via magic link should automatically mark the email as verified', async function () {
        await this.http_post_json('/auth/magic-link/request', {
            _csrf: await this.csrf_token(),
            email: 'mocha@authwall.test',
        });

        await this.http_post_json('/auth/magic-link/confirm', {
            _csrf: await this.csrf_token(),
            email: 'mocha@authwall.test',
            code: this.sent_emails[0].placeholders.code,
        });

        const status = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status, {
            error: null,
            authenticated: true,
        });
        assert.ok(status.providers.find(v => v.type === 'email' && v.value === 'mocha@authwall.test').verified_at !== null);
    });

});
