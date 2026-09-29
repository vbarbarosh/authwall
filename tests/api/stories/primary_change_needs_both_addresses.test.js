const assert = require('assert');
const config = require('../../../config');
const db = require('../../../db');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See primary_change_needs_both_addresses.md. Fails until the change asks the
// current primary for approval.
describe('Changing the primary address needs both addresses | stories', function () {

    async function primary() {
        return db('user_identities').whereNotNull('primary_at').pluck('value_normalized');
    }

    it('a change confirmed only by the new address does not take effect', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});

        // 1. A borrowed session asks to move the account to its own address.
        await this.http_post_json(config.pages.email_change_request, {email: 'attacker@evil.test'});
        await this.wait_for_emails(2);
        const to_new = this.sent_emails.find(v => v.to === 'attacker@evil.test');
        const to_old = this.sent_emails.find(v => v.to === 'mocha@authwall.test');
        assert.ok(to_new, 'no confirmation link went to the new address');
        assert.ok(to_old, 'no approval request went to the current primary');

        // 2. The attacker confirms the new address.
        await this.http_get_json(urlmod(config.pages.email_change_confirm, {token: to_new.placeholders.token}));
        assert.deepStrictEqual(await primary(), ['mocha@authwall.test']);
    });

});
