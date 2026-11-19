const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');

const MINUTE = 60*1000;

// See added_address_asks_the_owner.md.
describe('Adding an address asks "confirm it is you" | stories', function () {

    beforeEach(function () {
        config.flows.github.enabled = true;
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    function account_emails() {
        return db('user_identities').where({type: const_user_identity.email}).pluck('value_normalized');
    }

    // The borrower's add is refused, nothing is added or mailed, and the
    // session keeps where to come back once confirmed.
    async function assert_add_refused(ctx) {
        await ctx.http_post_json('/auth/email/add', {email: 'mallory@evil.test'});
        const status = await ctx.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Confirm it is you before adding an email');
        assert.strictEqual(status.confirmed, false);
        assert.deepStrictEqual(status.confirmation, {next: config.pages.profile, reason: 'email_add'});
        assert.deepStrictEqual(await account_emails(), []);
        assert.deepStrictEqual(ctx.sent_emails.map(v => v.name), []);
        return status;
    }

    it('a borrowed session of a username account cannot add its own address, so no reset reaches it (AW-119)', async function () {
        await this.sign_in({username: 'ann', password: 'anns-pass'});

        await assert_add_refused(this);

        await this.http_post_json('/auth/password-reset/request', {email: 'mallory@evil.test'});
        assert.deepStrictEqual(this.sent_emails.map(v => v.name), []);
        await this.assert_password({username: 'ann', password: 'anns-pass'});
    });

    it('a pending address goes without asking, and the add after it still asks', async function () {
        await this.sign_in({username: 'ann', email: 'ann@authwall.test', password: 'anns-pass', verified: false});

        await this.http_post_json('/auth/email/remove');
        assert.strictEqual((await this.http_get_json('/auth/status')).error, null);
        await assert_add_refused(this);
    });

    it('an account GitHub made without an address asks too, and offers GitHub to confirm', async function () {
        const {user_id} = await this.sign_in({username: 'tmp', password: 'tmp-pass'});
        const now = new Date();
        await db('user_identities').where({user_id}).delete();
        await db('user_identities').insert({uid: random_uid_user_identity(), user_id, type: const_user_identity.oauth_github, value: '777', value_normalized: '777', created_at: now, updated_at: now, verified_at: now});
        await db('users').where({id: user_id}).update({password_hash: null});

        const status = await assert_add_refused(this);
        assert.strictEqual(status.has_password, false);
        assert.deepStrictEqual(status.providers.map(v => v.type), [const_user_identity.oauth_github]);
    });

    it('the owner confirms with the password, adds the address again, and it gets its code', async function () {
        await this.sign_in({username: 'ann', password: 'anns-pass'});
        await this.http_post_json('/auth/email/add', {email: 'ann@authwall.test'});
        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Confirm it is you before adding an email');

        await this.confirm({password: 'anns-pass'});
        await this.http_post_json('/auth/email/add', {email: 'ann@authwall.test'});
        await this.wait_for_emails(1);

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, null);
        assert.strictEqual(status.confirmation, null);
        assert.deepStrictEqual(await account_emails(), ['ann@authwall.test']);
        assert.strictEqual(this.sent_emails[0].name, const_email.confirm_email);
        assert.strictEqual(this.sent_emails[0].to, 'ann@authwall.test');
    });

    describe('held at the verify step', function () {

        beforeEach(function () {
            config.confirm_email.required = true;
        });

        it('fixes a typo within ten minutes of signing in, without asking', async function () {
            await this.sign_in({username: 'ann', email: 'typo@authwall.test', password: 'anns-pass', verified: false});

            await this.http_post_json('/auth/email/remove');
            await this.http_post_json('/auth/email/add', {email: 'ann@authwall.test'});
            await this.wait_for_emails(1);

            assert.strictEqual((await this.http_get_json('/auth/status')).error, null);
            assert.deepStrictEqual(await account_emails(), ['ann@authwall.test']);
        });

        it('a session signed in eleven minutes ago signs in again first', async function () {
            await this.sign_in({username: 'ann', email: 'typo@authwall.test', password: 'anns-pass', verified: false});
            await db('sessions').update({created_at: new Date(Date.now() - 11*MINUTE)});

            await this.http_post_json('/auth/email/remove');
            await this.http_post_json('/auth/email/add', {email: 'mallory@evil.test'});
            assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Sign in again before adding an email');
            assert.deepStrictEqual(await account_emails(), []);
            assert.deepStrictEqual(this.sent_emails.map(v => v.name), []);

            await this.http_post_json('/auth/sign-in', {username: 'ann', password: 'anns-pass'});
            await this.http_post_json('/auth/email/add', {email: 'ann@authwall.test'});
            await this.wait_for_emails(1);
            assert.deepStrictEqual(await account_emails(), ['ann@authwall.test']);
        });

    });

});
