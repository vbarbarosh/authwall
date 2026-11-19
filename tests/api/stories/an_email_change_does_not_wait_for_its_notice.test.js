const als = require('../../../src/helpers/als');
const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const {mock} = require('node:test');

// See an_email_change_does_not_wait_for_its_notice.md.
describe('An email change does not wait for its notice | stories', function () {

    afterEach(function () {
        mock.restoreAll();
    });

    // Bea asks to change her address; the old one approves; her new one
    // gets its link. Returns the token of that link.
    async function ask_and_approve(ctx) {
        await ctx.sign_in({email: 'old@authwall.test', password: 'pass1234'});
        await ctx.http_post_json('/auth/email-change/request', {email: 'new@authwall.test'});
        await ctx.approve_email_change();
        const {confirm_link} = ctx.sent_emails.find(v => v.to === 'new@authwall.test').placeholders;
        return new URL(confirm_link).searchParams.get('token');
    }

    async function read_addresses(ctx) {
        const status = await ctx.http_get_json('/auth/status');
        return status.providers.filter(v => v.type === 'email').map(v => v.value_normalized);
    }

    it('answers the browser while the notice to the old address is still on its way (M-06)', async function () {
        const token = await ask_and_approve(this);
        const {csrf_token} = await this.http_get_json('/auth/status');
        const delivery = Promise.withResolvers();
        const original_send = als.mailer.send;
        mock.method(als.mailer, 'send', async function (params) {
            if (params.name === const_email.email_changed) {
                await delivery.promise;
            }
            return original_send(params);
        });

        const sent_before = this.sent_emails.length;
        const deadline = Promise.withResolvers();
        const timer = setTimeout(v => deadline.resolve(v), 1000, null);
        try {
            const response = await Promise.race([this.client.post_json_no_redirects('/auth/email-change/confirm/open', {_csrf: csrf_token, token}), deadline.promise]);
            assert.ok(response, 'The answer waited for the notice');
            assert.strictEqual(response.status, 302);
            assert.strictEqual(response.headers.location, config.pages.email_change_success);
        }
        finally {
            clearTimeout(timer);
            delivery.resolve();
        }
        assert.deepStrictEqual(await read_addresses(this), ['new@authwall.test']);
        await this.wait_for_emails(sent_before + 1);
        assert.strictEqual(this.sent_emails.at(-1).name, const_email.email_changed);
    });

    it('keeps the change when the notice fails, and logs the failure (M-06)', async function () {
        const token = await ask_and_approve(this);
        const original_send = als.mailer.send;
        mock.method(als.mailer, 'send', async function (params) {
            if (params.name === const_email.email_changed) {
                throw new Error('mail unavailable');
            }
            return original_send(params);
        });

        await this.http_post_json('/auth/email-change/confirm/open', {token});

        assert.deepStrictEqual(await read_addresses(this), ['new@authwall.test']);
        assert.match(this.written_logs.join('\n'), /send_email_nothrow_error.*mail unavailable/);
    });

});
