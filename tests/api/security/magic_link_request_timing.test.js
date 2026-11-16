const als = require('../../../src/helpers/als');
const assert = require('assert');
const bcrypt = require('bcrypt');
const config = require('../../../config');
const db = require('../../../db');
const {mock} = require('node:test');

describe('magic-link request enumeration', function () {
    afterEach(function () {
        mock.restoreAll();
    });

    for (const mode of ['link', 'code', 'link_and_code']) {
        it(`does the same challenge work for verified, unknown and pending addresses in ${mode} mode`, async function () {
            await this.add_user({email: 'verified@example.com'});
            await this.add_user({email: 'pending@example.com', verified: false});
            config.sign_up.enabled = false;
            config.flows.magic_link.mode = mode;
            const hash = mock.method(bcrypt, 'hash');
            const {csrf_token} = await this.http_get_json('/auth/status');

            for (const email of ['verified@example.com', 'unknown@example.com', 'pending@example.com']) {
                const before = hash.mock.callCount();
                const response = await this.client.post_json_no_redirects('/auth/magic-link/request', {_csrf: csrf_token, email});
                assert.strictEqual(response.status, 302);
                assert.strictEqual(response.headers.location, `/auth/magic-link/sent?email=${encodeURIComponent(email)}`);
                assert.strictEqual(hash.mock.callCount() - before, mode === 'link' ? 0 : 1);
                const challenge = await db('magic_links').where({email_normalized: email}).first();
                assert.ok(challenge);
                assert.strictEqual(Boolean(challenge.code_hash), mode !== 'link');
                assert.strictEqual((await this.client.get_session()).magic_link_id, challenge.id);

                const repeated = await this.client.post_json_no_redirects('/auth/magic-link/request', {_csrf: csrf_token, email});
                assert.strictEqual(repeated.status, response.status);
                assert.strictEqual(repeated.headers.location, response.headers.location);
                assert.strictEqual(hash.mock.callCount() - before, mode === 'link' ? 0 : 2);
                assert.strictEqual((await db('magic_links').where({email_normalized: email})).length, 1);
                assert.deepStrictEqual(await db('magic_links').where({id: challenge.id}).first(), challenge);
                assert.strictEqual((await this.client.get_session()).magic_link_id, challenge.id);
                assert.strictEqual((await this.http_get_json('/auth/status')).error, null);
            }

            await this.wait_for_emails(1);
            assert.deepStrictEqual(this.sent_emails.map(v => v.to), ['verified@example.com']);
            assert.strictEqual((await db('users')).length, 2);
        });

        it(`responds before a slow mailer finishes in ${mode} mode`, async function () {
            await this.add_user({email: 'verified@example.com'});
            config.sign_up.enabled = false;
            config.flows.magic_link.mode = mode;
            const {csrf_token} = await this.http_get_json('/auth/status');
            const delivery = Promise.withResolvers();
            const entered = Promise.withResolvers();
            const original_send = als.mailer.send;
            mock.method(als.mailer, 'send', async function (params) {
                entered.resolve();
                await delivery.promise;
                return original_send(params);
            });

            // A held mailer, rather than a wall-clock comparison, makes the
            // regression independent of machine load and the bcrypt cost.
            const deadline = Promise.withResolvers();
            const timer = setTimeout(v => deadline.resolve(v), 1000, null);
            try {
                const request = this.client.post_json_no_redirects('/auth/magic-link/request', {_csrf: csrf_token, email: 'verified@example.com'});
                const response = await Promise.race([request, deadline.promise]);
                assert.ok(response, 'The response waited for email delivery');
                assert.strictEqual(response.status, 302);
                await entered.promise;
                assert.strictEqual(this.sent_emails.length, 0);
                assert.strictEqual((await this.http_get_json('/auth/status')).error, null);
            }
            finally {
                clearTimeout(timer);
                delivery.resolve();
                await this.wait_for_emails(1);
            }

            const {link, code} = this.sent_emails[0].placeholders;
            if (mode === 'link') {
                await this.open_link(link);
            }
            else {
                await this.http_post_json('/auth/magic-link/confirm', {email: 'verified@example.com', code});
            }
            assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);
        });
    }

    for (const mode of ['code', 'link_and_code']) {
        it(`hashes cooldown requests from a fresh browser without replacing or sharing the original ${mode}`, async function () {
            await this.add_user({email: 'verified@example.com'});
            config.sign_up.enabled = false;
            config.flows.magic_link.mode = mode;
            await this.http_post_json('/auth/magic-link/request', {email: 'verified@example.com'});
            await this.wait_for_emails(1);
            const owner_cookies = this.client.cookies;
            const challenge = await db('magic_links').where({email_normalized: 'verified@example.com'}).first();
            const {code} = this.sent_emails[0].placeholders;

            this.client.cookies = new Map();
            const {csrf_token} = await this.http_get_json('/auth/status');
            const hash = mock.method(bcrypt, 'hash');
            const repeated = await this.client.post_json_no_redirects('/auth/magic-link/request', {_csrf: csrf_token, email: 'verified@example.com'});
            assert.strictEqual(repeated.status, 302);
            assert.strictEqual(repeated.headers.location, '/auth/magic-link/sent?email=verified%40example.com');
            assert.strictEqual(hash.mock.callCount(), 1);
            assert.strictEqual((await this.client.get_session()).magic_link_id, undefined);
            await this.http_post_json('/auth/magic-link/confirm', {email: 'verified@example.com', code});
            assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: false, error: 'Invalid or expired code'});

            const fresh = await this.client.post_json_no_redirects('/auth/magic-link/request', {_csrf: csrf_token, email: 'unknown@example.com'});
            assert.strictEqual(fresh.status, repeated.status);
            assert.strictEqual(hash.mock.callCount(), 2);
            assert.deepStrictEqual(await db('magic_links').where({id: challenge.id}).first(), challenge);
            assert.strictEqual(this.sent_emails.length, 1);

            this.client.cookies = owner_cookies;
            await this.http_post_json('/auth/magic-link/request', {email: 'verified@example.com'});
            assert.strictEqual(hash.mock.callCount(), 3);
            assert.strictEqual((await this.client.get_session()).magic_link_id, challenge.id);
            assert.deepStrictEqual(await db('magic_links').where({id: challenge.id}).first(), challenge);
            assert.strictEqual(this.sent_emails.length, 1);
            await this.http_post_json('/auth/magic-link/confirm', {email: 'verified@example.com', code});
            assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);
        });
    }

    it('logs delivery failures without exposing them through the response or session', async function () {
        await this.add_user({email: 'verified@example.com'});
        config.sign_up.enabled = false;
        mock.method(als.mailer, 'send', async function () {
            throw new Error('mail unavailable');
        });

        await this.http_post_json('/auth/magic-link/request', {email: 'verified@example.com'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: false, error: null});
        assert.match(this.written_logs.join('\n'), /complete_magic_link_request_error.*mail unavailable/);
        assert.strictEqual(this.sent_emails.length, 0);
    });
});
