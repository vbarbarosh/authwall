const assert = require('assert');
const config = require('../../../config');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// One-time credentials travel as query parameters, and every request is
// logged. A token that reaches a log file is a working sign-in credential for
// anyone who can read that file — an operator, a log shipper, or a backup.
describe('request log redaction', function () {

    it('does not log a magic-link token', async function () {
        config.flows.magic_link.enabled = true;
        config.mailer.enabled = true;

        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        await this.wait_for_emails(1);
        const {link} = this.sent_emails.find(v => v.placeholders?.link).placeholders;
        const token = new URL(link).searchParams.get('token');

        await this.client.get_json(urlmod(config.pages.magic_link_confirm, {token}));

        const logs = this.written_logs.join('\n');
        assert.strictEqual(logs.includes(token), false);
        assert.ok(logs.includes('/auth/magic-link/confirm?token=%5BFiltered%5D'));
    });

    it('still logs parameters that carry no credential', async function () {
        await this.client.get_json_no_redirects('/auth/sign-in?return=%2Fprofile');

        const logs = this.written_logs.join('\n');
        assert.ok(logs.includes('/auth/sign-in?return=%2Fprofile'));
    });

});
