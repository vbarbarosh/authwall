const assert = require('assert');
const config = require('../../../config');

describe('Brute-force protection', function () {

    // Magic link code attempts are capped in the DB via
    // config.flows.magic_link.max_attempts, independent of the IP-based rate
    // limiter. Pin it to 3 here so the per-attempt assertions below stay exact
    // regardless of the configured default. The suite-level beforeEach restores
    // config before the next test.
    beforeEach(function () {
        config.flows.magic_link.max_attempts = 3;
    });

    it('blocks magic link confirm after 3 wrong code attempts', async function () {
        await this.http_post_json('/auth/magic-link/request', {
            email: 'mocha@authwall.test',
        });

        // exhaust attempts with wrong codes
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: '000000'});
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: '000000'});
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: '000000'});

        // correct code should now be rejected too
        const {code} = this.sent_emails[0].placeholders;
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code});

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid or expired code',
            authenticated: false,
        });
    });

    it('allows magic link confirm before attempt limit is reached', async function () {
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});

        // two wrong attempts (limit is 3)
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: '000000'});
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: '000000'});

        // correct code on third attempt should succeed
        await this.http_post_json('/auth/magic-link/confirm', {
            email: 'mocha@authwall.test',
            code: this.sent_emails[0].placeholders.code,
        });

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });
    });

});
