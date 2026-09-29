const assert = require('assert');
const config = require('../../../config');
const db = require('../../../db');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// AW-27, AW-37: a change link or a verification link must die when the
// account's address changes or goes, or it can undo the owner's choice later.
describe('A changed or removed address kills its sibling links | stories', function () {

    function change_link(ctx, email) {
        const sent = ctx.sent_emails.find(v => v.placeholders?.token && (v.to === email));
        assert.ok(sent, `an email-change link should be sent to ${email}`);
        return urlmod(config.pages.email_change_confirm, {token: sent.placeholders.token});
    }

    async function account_emails() {
        return db('user_identities').where({type: 'email'}).pluck('value_normalized');
    }

    it('kills a second change link once the owner confirms their own', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json(config.pages.email_change_request, {email: 'attacker@evil.test'});
        await this.approve_email_change();
        await this.http_post_json(config.pages.email_change_request, {email: 'owner-new@authwall.test'});
        await this.approve_email_change();

        await this.http_get_json(change_link(this, 'owner-new@authwall.test'));
        assert.deepStrictEqual(await account_emails(), ['owner-new@authwall.test']);

        await this.http_get_json(change_link(this, 'attacker@evil.test'));
        assert.deepStrictEqual(await account_emails(), ['owner-new@authwall.test']);
    });

    it('kills a change link when the address is removed, so a re-added one is safe', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json(config.pages.email_change_request, {email: 'attacker@evil.test'});
        await this.approve_email_change();
        await this.http_post_json('/auth/email/remove');
        await this.http_post_json('/auth/email/add', {email: 'other@authwall.test'});
        assert.strictEqual((await this.http_get_json('/auth/status')).error, null);

        await this.http_get_json(change_link(this, 'attacker@evil.test'));
        assert.deepStrictEqual(await account_emails(), ['other@authwall.test']);
    });

    it('kills a verification link when its address is removed', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        await this.http_post_json('/auth/email/add', {email: 'typo@authwall.test'});
        const verify = this.sent_emails.find(v => v.placeholders?.link && (v.to === 'typo@authwall.test'));
        await this.http_post_json('/auth/email/remove');

        const link = new URL(verify.placeholders.link);
        await this.http_get_json(link.pathname + link.search);
        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Invalid or expired verification link');
    });

});
