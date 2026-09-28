const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');
const db = require('../../../db');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// M-05: changing the password is how an owner shuts out a borrowed session,
// so it must kill what that session left behind, as a reset does.
describe('A password change settles the recovery | stories', function () {

    beforeEach(function () {
        config.flows.password.min_password_length = 4;
        config.personal_access_tokens.enabled = true;
    });

    const routes = [
        {label: 'profile', url: '/auth/profile'},
        {label: 'change-password', url: '/auth/change-password'},
    ];

    for (const route of routes) {

        it(`kills an email change requested before the change (${route.label})`, async function () {
            await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
            await this.http_post_json(config.pages.email_change_request, {email: 'attacker@evil.test'});
            const change = this.sent_emails.find(v => v.placeholders?.token && (v.to === 'attacker@evil.test'));
            assert.ok(change, 'an email-change link should be sent');

            await this.http_post_json(route.url, {current_password: 'pass123', password: 'pass456', password_confirm: 'pass456'});
            assert.strictEqual((await this.http_get_json('/auth/status')).error, null);

            await this.http_get_json(urlmod(config.pages.email_change_confirm, {token: change.placeholders.token}));
            const emails = await db('user_identities').where({type: 'email'}).pluck('value_normalized');
            assert.deepStrictEqual(emails, ['mocha@authwall.test']);
        });

        it(`kills the verification of an address added before the change (${route.label})`, async function () {
            await this.sign_in({username: 'mocha', password: 'pass123'});
            await this.http_post_json('/auth/email/add', {email: 'attacker@evil.test'});
            const verify = this.sent_emails.find(v => v.placeholders?.link && (v.to === 'attacker@evil.test'));
            assert.ok(verify, 'a verification link should be sent');

            await this.http_post_json(route.url, {current_password: 'pass123', password: 'pass456', password_confirm: 'pass456'});
            assert.strictEqual((await this.http_get_json('/auth/status')).error, null);

            const link = new URL(verify.placeholders.link);
            await this.http_get_json(link.pathname + link.search);
            const ident = await db('user_identities').where({type: 'email', value_normalized: 'attacker@evil.test'}).first();
            assert.strictEqual(ident.verified_at, null);
        });

        it(`revokes every personal access token (${route.label})`, async function () {
            await this.sign_in({username: 'mocha', password: 'pass123'});
            const created = await this.http_post_json('/auth/personal-access-tokens', {label: 'ci'});

            await this.http_post_json(route.url, {current_password: 'pass123', password: 'pass456', password_confirm: 'pass456'});
            assert.strictEqual((await this.http_get_json('/auth/status')).error, null);

            const r = await axios.get('/private/page', {baseURL: config.public_url, headers: {Authorization: `Bearer ${created.token}`}, maxRedirects: 0, validateStatus: () => true});
            assert.strictEqual(r.status, 401);
        });

    }

});
