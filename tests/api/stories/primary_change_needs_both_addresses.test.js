const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const db = require('../../../db');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See primary_change_needs_both_addresses.md.
describe('Changing the primary address needs both addresses | stories', function () {

    async function primary() {
        return db('user_identities').whereNotNull('primary_at').pluck('value_normalized');
    }

    it('a change the current primary does not approve does not take effect', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});

        // A borrowed session asks to move the account to its own address.
        await this.http_post_json(config.pages.email_change_request, {email: 'attacker@evil.test'});

        // Only the current primary hears about it; the new address gets nothing.
        assert.deepStrictEqual(this.sent_emails.map(v => [v.name, v.to]), [[const_email.email_change_approve, 'mocha@authwall.test']]);
        assert.deepStrictEqual(await primary(), ['mocha@authwall.test']);
    });

    it('moves the primary once the old address approves and the new one confirms', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json(config.pages.email_change_request, {email: 'mocha@new.test'});

        await this.approve_email_change();
        const {token} = this.sent_emails.find(v => v.to === 'mocha@new.test').placeholders;
        assert.deepStrictEqual(await primary(), ['mocha@authwall.test']);

        await this.http_get_json(urlmod(config.pages.email_change_confirm, {token}));
        assert.deepStrictEqual(await primary(), ['mocha@new.test']);
        assert.ok(this.sent_emails.some(v => (v.name === const_email.email_changed) && (v.to === 'mocha@authwall.test')));
    });

    it('does not accept an approval link twice', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json(config.pages.email_change_request, {email: 'mocha@new.test'});
        await this.approve_email_change();

        const {token} = this.sent_emails.find(v => v.name === const_email.email_change_approve).placeholders;
        await this.http_get_json(urlmod(config.pages.email_change_approve, {token}));
        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Invalid or expired approval link');
    });

    it('asks an account without a primary to confirm it is you before the change', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123', verified: false});

        await this.http_post_json(config.pages.email_change_request, {email: 'mocha@new.test'});
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Confirm it is you before changing your email');
        assert.deepStrictEqual(status.confirmation, {next: config.pages.email_change_request, reason: 'email_change'});
        assert.deepStrictEqual(this.sent_emails, []);

        await this.confirm({password: 'pass123'});
        await this.http_post_json(config.pages.email_change_request, {email: 'mocha@new.test'});
        assert.deepStrictEqual(this.sent_emails.map(v => [v.name, v.to]), [[const_email.email_change_requested, 'mocha@new.test']]);
        assert.strictEqual((await this.http_get_json('/auth/status')).confirmation, null);
    });

});
