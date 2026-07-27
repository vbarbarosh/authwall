const assert = require('assert');
const config = require('../../../config');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// Authwall behind nginx `auth_request` / Caddy `forward_auth`: the reverse
// proxy only ever sees the status code of /auth/sidecar, so that check has to
// carry the same email-verification rule the proxy path enforces.
describe('Sidecar auth check and an unverified email | stories', function () {

    it('rejects until the email is confirmed, then admits', async function () {
        config.confirm_email.required = true;

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});

        try {
            await this.client.get_json_no_redirects('/auth/sidecar');
            assert.ok(false, 'sidecar admitted an unconfirmed user');
        }
        catch (error) {
            assert.strictEqual(error.response.status, 403);
            assert.strictEqual(error.response.headers['x-auth-user'], undefined);
        }

        await this.http_post_json('/auth/email-verify/request');
        await this.wait_for_emails(1);
        const {link} = this.sent_emails.find(v => v.placeholders?.link).placeholders;
        const token = new URL(link).searchParams.get('token');
        await this.http_get_json(urlmod(config.pages.email_verify_confirm, {token}));

        const sidecar = await this.client.get_json_no_redirects('/auth/sidecar');
        assert.strictEqual(sidecar.status, 200);
        assert.ok(sidecar.headers['x-auth-user']);
    });

});
