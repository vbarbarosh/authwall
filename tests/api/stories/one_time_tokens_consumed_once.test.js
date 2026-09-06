const assert = require('assert');
const bcrypt = require('bcrypt');
const config = require('../../../config');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_email = require('../../../src/helpers/const/const_email');
const db = require('../../../db');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// [concurrent] hands each request its own pooled connection, as in
// production; see mocha.api.js. Inside the usual per-test transaction the
// racing requests would share one connection and the loser's savepoint
// rollback would erase the winner's writes.
describe('One-time tokens are consumed exactly once | stories', function () {

    beforeEach(function () {
        config.flows.password.min_password_length = 4;
    });

    // Fires the same request from independent browsers at the same instant.
    // Each browser first gets a session and a CSRF token of its own; the
    // requests are then dispatched in one synchronous sweep, each capturing
    // its own cookie jar before the next swap.
    async function race(ctx, count, fn)
    {
        const browsers = [];
        for (let i = 0; i < count; i++) {
            ctx.client.cookies = new Map();
            const {csrf_token} = await ctx.client.get_json('/auth/status');
            browsers.push({cookies: ctx.client.cookies, csrf_token});
        }
        return Promise.all(browsers.map(function ({cookies, csrf_token}, i) {
            ctx.client.cookies = cookies;
            return fn(i, csrf_token);
        }));
    }

    it('lets exactly one of two simultaneous reset confirms through [concurrent]', async function () {
        await this.add_user({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        await this.http_post_json('/auth/password-reset/request', {email: 'mocha@authwall.test'});
        const {token} = this.sent_emails.find(v => v.name === const_email.password_reset).placeholders;

        const passwords = ['first1', 'second2'];
        await race(this, 2, (i, _csrf) => this.client.post_json('/auth/password-reset/confirm', {
            _csrf, token, password: passwords[i], password_confirm: passwords[i],
        }));

        assert.strictEqual((await db('auth_events').where({event_type: const_auth_event.password_reset_completed})).length, 1);
        const {password_hash} = await db('users').first();
        const matches = await Promise.all(passwords.map(v => bcrypt.compare(v, password_hash)));
        assert.strictEqual(matches.filter(Boolean).length, 1);
    });

    it('creates one account when the same magic link is opened twice at once [concurrent]', async function () {
        await this.http_post_json('/auth/magic-link/request', {email: 'fresh@authwall.test'});
        const {token} = this.sent_emails.find(v => v.name === const_email.magic_link).placeholders;

        await race(this, 2, () => this.client.get_json_no_redirects(urlmod(config.pages.magic_link_confirm, {token})));

        assert.strictEqual((await db('users')).length, 1);
        assert.strictEqual((await db('user_identities')).length, 1);
        assert.strictEqual((await db('auth_events').where({event_type: const_auth_event.sign_up})).length, 1);
    });

    it('counts simultaneous wrong codes against the cap, not against a stale read [concurrent]', async function () {
        config.flows.magic_link.max_attempts = 3;
        await this.add_user({email: 'mocha@authwall.test'});
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        const {code} = this.sent_emails.find(v => v.name === const_email.magic_link).placeholders;

        await race(this, 5, (_, _csrf) => this.client.post_json('/auth/magic-link/confirm', {_csrf, email: 'mocha@authwall.test', code: '000000'}));
        assert.strictEqual((await db('magic_links').first()).attempts, 3);

        // The guesses were spent: the right code no longer signs in.
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: false, error: 'Invalid or expired code',
        });
    });

    it('verifies once when the same verification link is opened twice at once [concurrent]', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        await this.http_post_json('/auth/email-verify/request');
        await this.wait_for_emails(1);
        const {link} = this.sent_emails.find(e => e.placeholders?.link).placeholders;
        const token = new URL(link).searchParams.get('token');

        await race(this, 2, () => this.client.get_json_no_redirects(urlmod(config.pages.email_verify_confirm, {token})));

        assert.strictEqual((await db('auth_events').where({event_type: const_auth_event.email_verified})).length, 1);
    });
});
