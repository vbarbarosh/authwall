const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');

// Google ignores a "+tag" suffix and delivers to the same mailbox, so the
// access rules — which match the normalized address — must see through it.
// Otherwise a denylist naming "bad@gmail.com" is bypassed by "bad+x@gmail.com",
// and an allowlist rejects the owner's own tagged address.
describe('gmail plus-addressing and access rules', function () {

    it('a denied gmail address is not bypassed by a +tag', async function () {
        config.access.denied_emails = ['bad@gmail.com'];

        await this.http_post_json('/auth/sign-up', {
            email: 'bad+promo@gmail.com',
            password: 'pass1234',
            password_confirm: 'pass1234',
        });

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, false);

        const ident = await db('user_identities')
            .where({type: const_user_identity.email, value_normalized: 'bad@gmail.com'})
            .first();
        assert.strictEqual(ident, undefined);
    });

    it('an allowed gmail address admits the owner\'s +tag', async function () {
        config.access.allowed_emails = ['foo@gmail.com'];

        await this.http_post_json('/auth/sign-up', {
            email: 'foo+newsletter@gmail.com',
            password: 'pass1234',
            password_confirm: 'pass1234',
        });

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, true, status.error);

        const ident = await db('user_identities')
            .where({type: const_user_identity.email, value_normalized: 'foo@gmail.com'})
            .first();
        assert.ok(ident, 'identity stored under the canonical gmail address');
    });

    it('two +tag variants of one gmail mailbox collapse to a single account', async function () {
        await this.http_post_json('/auth/sign-up', {
            email: 'mocha+one@gmail.com',
            password: 'pass1234',
            password_confirm: 'pass1234',
        });
        await this.http_post_json('/auth/sign-out', {});

        // The duplicate is rejected inside the flow; the message is surfaced
        // through /auth/status, not the POST body.
        await this.http_post_json('/auth/sign-up', {
            email: 'mocha+two@gmail.com',
            password: 'pass1234',
            password_confirm: 'pass1234',
        });
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, false);
        assert.ok(String(status.error || '').includes('already exists'), `expected duplicate rejection, got ${JSON.stringify(status.error)}`);

        const rows = await db('user_identities').where({type: const_user_identity.email, value_normalized: 'mocha@gmail.com'});
        assert.strictEqual(rows.length, 1);
    });
});
