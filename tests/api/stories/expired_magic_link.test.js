const assert = require('assert');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const date_trunc_ms = require('../../../src/helpers/date/date_trunc_ms');
const db = require('../../../db');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// A user who is already signed in visits an expired magic link.
// The link must fail cleanly without disrupting the authenticated session.
describe('Expired magic link does not affect authenticated session | stories', function () {

    it('fails cleanly and leaves the session authenticated', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});

        // Request a magic link (while already signed in)
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});

        // Expire the magic link
        const magic_link = await db('magic_links').where({token_hash: crypto_hash_sha256(this.sent_emails[0].placeholders.token).toString('base64url')}).first();
        await db('magic_links').where({id: magic_link.id}).update({expires_at: date_trunc_ms()});

        // Try to use the expired link
        await this.http_get_json(urlmod('/auth/magic-link/confirm', {token: this.sent_emails[0].placeholders.token}));

        // Session must still be authenticated
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid or expired magic link',
            authenticated: true,
        });
    });

});
