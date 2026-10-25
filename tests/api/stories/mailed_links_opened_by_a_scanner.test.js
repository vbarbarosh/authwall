const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const db = require('../../../db');

// See mailed_links_opened_by_a_scanner.md.
describe('A mail scanner opens every link in the mail | stories', function () {

    beforeEach(function () {
        config.flows.password.min_password_length = 4;
    });

    // What a link-scanning mail filter does: a cookieless GET of the link and of
    // what its page asks, pressing nothing. Answers what the scanner holds after.
    async function scan(ctx, link) {
        const owner = ctx.client.cookies;
        ctx.client.cookies = new Map();
        const {pathname, search} = new URL(link, config.public_url);
        await ctx.client.get_json(pathname + search);
        await ctx.client.get_json(`${pathname}/open${search}`);
        const scanner = await ctx.http_get_json('/auth/status');
        ctx.client.cookies = owner;
        return scanner;
    }

    function sent(ctx, name) {
        return ctx.sent_emails.findLast(v => v.name === name).placeholders;
    }

    function account_emails() {
        return db('user_identities').where({type: 'email'}).pluck('value_normalized');
    }

    it('the sign-in link: the scanner is not signed in, Ann is, once she presses Sign in', async function () {
        await this.add_user({email: 'ann@authwall.test'});
        await this.http_post_json('/auth/magic-link/request', {email: 'ann@authwall.test'});
        const {link} = sent(this, const_email.magic_link);

        const scanner = await scan(this, link);
        assert.strictEqual(scanner.authenticated, false);
        assert.strictEqual((await db('magic_links').first()).used_at, null);

        await this.open_link(link);
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);
    });

    it('the confirmation link: Mark keeps his password, his session and his link', async function () {
        config.confirm_email.required = true;
        await this.http_post_json('/auth/sign-up', {email: 'mark@corp.test', password: 'marks-pass', password_confirm: 'marks-pass'});
        await this.wait_for_emails(1);
        const {link} = this.sent_emails.find(v => v.placeholders?.link).placeholders;

        const scanner = await scan(this, link);
        assert.strictEqual(scanner.authenticated, false);
        await this.assert_password({email: 'mark@corp.test', password: 'marks-pass'});
        assert.strictEqual((await db('email_verify_tokens').first()).used_at, null);
        assert.strictEqual((await db('password_reset_tokens')).length, 0);

        const tap = await this.open_link_no_redirects(link);
        assert.strictEqual(tap.headers.location, config.pages.email_verify_success);
    });

    it('the approval link: a move asked from a borrowed session goes nowhere', async function () {
        await this.sign_in({email: 'ann@authwall.test', password: 'anns-pass'});
        await this.http_post_json(config.pages.email_change_request, {email: 'attacker@evil.test'});
        const {approve_link} = sent(this, const_email.email_change_approve);

        await scan(this, approve_link);
        assert.strictEqual((await db('email_change_tokens').first()).approved_at, null);
        assert.deepStrictEqual(this.sent_emails.map(v => [v.name, v.to]), [[const_email.email_change_approve, 'ann@authwall.test']]);

        // Ann's own move goes through only when she presses Approve.
        await this.http_post_json(config.pages.email_change_request, {email: 'ann-new@authwall.test'});
        await this.open_link(sent(this, const_email.email_change_approve).approve_link);
        assert.strictEqual(sent(this, const_email.email_change_requested).new_email, 'ann-new@authwall.test');
    });

    it('the new address\'s link: the account keeps its address until Ann presses Confirm', async function () {
        await this.sign_in({email: 'ann@authwall.test', password: 'anns-pass'});
        await this.http_post_json(config.pages.email_change_request, {email: 'ann-new@authwall.test'});
        await this.approve_email_change();
        const {confirm_link} = sent(this, const_email.email_change_requested);

        await scan(this, confirm_link);
        assert.deepStrictEqual(await account_emails(), ['ann@authwall.test']);

        await this.open_link(confirm_link);
        assert.deepStrictEqual(await account_emails(), ['ann-new@authwall.test']);
    });

});
