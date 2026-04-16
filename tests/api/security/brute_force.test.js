const assert = require('assert');

describe('Brute-force protection', function () {

    // Magic link code attempts are enforced in the DB (MAX_ATTEMPTS=3),
    // independent of the IP-based rate limiter.
    it('blocks magic link confirm after 3 wrong code attempts', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});

        // exhaust attempts with wrong codes
        for (let i = 0; i < 3; i++) {
            await this.client.post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: '000000', _csrf: status.csrf_token});
        }

        // correct code should now be rejected too
        const {code} = this.sent_emails[0].placeholders;
        await this.client.post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code, _csrf: status.csrf_token});

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, 'Invalid or expired code');
        assert.strictEqual(status2.authenticated, false);
    });

    it('allows magic link confirm before attempt limit is reached', async function () {
        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});

        // two wrong attempts (limit is 3)
        await this.client.post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: '000000', _csrf: status.csrf_token});
        await this.client.post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: '000000', _csrf: status.csrf_token});

        // correct code on third attempt should succeed
        const {code} = this.sent_emails[0].placeholders;
        await this.client.post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code, _csrf: status.csrf_token});

        const status2 = await this.client.get_json('/auth/status');
        assert.strictEqual(status2.error, null);
        assert.strictEqual(status2.authenticated, true);
    });

});
