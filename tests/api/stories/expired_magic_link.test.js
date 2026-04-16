const assert = require('assert');
const db = require('../../../db');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// A user who is already signed in visits an expired magic link.
// The link must fail cleanly without disrupting the authenticated session.
describe('Expired magic link does not affect authenticated session | stories', function () {

    it('fails cleanly and leaves the session authenticated', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});

        // Request a magic link (while already signed in)
        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email: 'mocha@authwall.test', _csrf: status.csrf_token});
        const {token} = this.sent_emails.find(e => e.placeholders?.token).placeholders;

        // Expire the magic link
        await db('magic_links').update({expires_at: new Date(Date.now() - 1000)});

        // Try to use the expired link
        await this.http_get_json(urlmod('/auth/magic-link/confirm', {token}));

        // Session must still be authenticated
        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.authenticated, true);
        assert.strictEqual(status2.error, 'Invalid or expired magic link');
    });

});
