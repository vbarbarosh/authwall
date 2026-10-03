const assert = require('assert');
const config = require('../../../config');

// See verification_link_on_another_device.md.
describe('You sign up on the laptop and confirm on the phone | stories', function () {

    beforeEach(function () {
        config.access.allowed_domains = ['corp.test'];
        config.confirm_email.required = true;
    });

    async function sign_up(_this) {
        await _this.http_post_json('/auth/sign-up', {email: 'mark@corp.test', password: 'marks-pass', password_confirm: 'marks-pass'});
        await _this.wait_for_emails(1);
        const {link} = _this.sent_emails.find(v => v.placeholders?.link).placeholders;
        return new URL(link).pathname + new URL(link).search;
    }

    it('confirmed on the phone, Mark sets a password there and signs in', async function () {
        const link = await sign_up(this);
        const laptop = new Map(this.client.cookies);

        this.client.cookies.clear();
        const tap = await this.client.get_json_no_redirects(link);
        assert.match(tap.headers.location, /^\/auth\/password-reset\/confirm\?token=/);
        const token = new URL(tap.headers.location, config.public_url).searchParams.get('token');
        await this.http_post_json('/auth/password-reset/confirm', {token, password: 'marks-new-pass', password_confirm: 'marks-new-pass'});
        await this.http_post_json('/auth/sign-in', {username: 'mark@corp.test', password: 'marks-new-pass'});
        const phone = await this.client.get_json_no_redirects('/private/data');
        assert.strictEqual(phone.status, 200);

        // The laptop was signed out and signs in again.
        this.client.cookies = laptop;
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, false);
    });

    it('confirmed on the laptop itself, nothing changes for Mark', async function () {
        const link = await sign_up(this);
        const tap = await this.client.get_json_no_redirects(link);
        assert.strictEqual(tap.headers.location, config.pages.email_verify_success);
        const laptop = await this.http_get_json('/auth/status');
        assert.strictEqual(laptop.authenticated, true);
        await this.http_post_json('/auth/sign-out');
        await this.http_post_json('/auth/sign-in', {username: 'mark@corp.test', password: 'marks-pass'});
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);
    });

});
