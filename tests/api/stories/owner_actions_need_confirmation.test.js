const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');

// See owner_actions_need_confirmation.md.
describe('Actions that need the owner ask "confirm it is you" | stories', function () {

    beforeEach(function () {
        config.flows.password.min_password_length = 4;
        config.personal_access_tokens.enabled = true;
        config.flows.github.enabled = true;
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    function account_emails() {
        return db('user_identities').where({type: const_user_identity.email}).pluck('value_normalized');
    }

    async function link_github(user_id) {
        const now = new Date();
        await db('user_identities').insert({uid: random_uid_user_identity(), user_id, type: const_user_identity.oauth_github, value: '777', value_normalized: '777', created_at: now, updated_at: now, verified_at: now});
    }

    // The action is refused, and the session remembers why and where to come back.
    async function assert_asked(ctx, message, confirmation) {
        const status = await ctx.http_get_json('/auth/status');
        assert.strictEqual(status.error, message);
        assert.strictEqual(status.confirmed, false);
        assert.deepStrictEqual(status.confirmation, confirmation);
    }

    it('a borrowed session cannot swap the primary address: removing it asks first (AW-77)', async function () {
        await this.sign_in({username: 'ann', email: 'ann@authwall.test', password: 'anns-pass'});

        await this.http_post_json('/auth/email/remove');
        await assert_asked(this, 'Confirm it is you before removing your email', {next: config.pages.profile, reason: 'email_remove'});
        assert.deepStrictEqual(await account_emails(), ['ann@authwall.test']);

        await this.confirm({password: 'anns-pass'});
        await this.http_post_json('/auth/email/remove');
        assert.deepStrictEqual(await account_emails(), []);
        assert.strictEqual((await this.http_get_json('/auth/status')).confirmation, null);
    });

    it('creating a personal access token asks first', async function () {
        await this.sign_in({username: 'ann', email: 'ann@authwall.test', password: 'anns-pass'});

        await this.http_post_json('/auth/personal-access-tokens', {label: 'ci'});
        await assert_asked(this, 'Confirm it is you before creating a token', {next: config.pages.personal_access_tokens, reason: 'pat_create'});
        assert.strictEqual((await db('personal_access_tokens')).length, 0);

        await this.confirm({password: 'anns-pass'});
        const created = await this.http_post_json('/auth/personal-access-tokens', {label: 'ci'});
        assert.match(created.token, /^awp_/);
    });

    it('setting a first password asks first, here with a code to the primary', async function () {
        await this.sign_in({username: 'ann', email: 'ann@authwall.test', password: 'anns-pass'});
        await db('users').update({password_hash: null});

        await this.http_post_json('/auth/change-password', {password: 'new-pass', password_confirm: 'new-pass'});
        await assert_asked(this, 'Confirm it is you before setting a password', {next: config.pages.profile, reason: 'first_password'});
        assert.strictEqual((await db('users').first()).password_hash, null);

        await this.confirm();
        await this.http_post_json('/auth/change-password', {password: 'new-pass', password_confirm: 'new-pass'});
        await this.assert_password({username: 'ann', password: 'new-pass'});
    });

    it('removing the account asks two ways: the password, then the code to the primary', async function () {
        await this.sign_in({username: 'ann', email: 'ann@authwall.test', password: 'anns-pass'});

        await this.http_post_json('/auth/account/remove', {confirmation: 'DELETE'});
        await assert_asked(this, 'Confirm it is you before removing your account', {next: config.pages.profile, reason: 'account_remove', factors: 2});
        assert.deepStrictEqual(this.sent_emails.map(v => [v.name, v.to]), [[const_email.confirm_code, 'ann@authwall.test']]);

        // The password alone is not enough.
        await this.confirm({password: 'anns-pass'});
        await this.http_post_json('/auth/account/remove', {confirmation: 'DELETE'});
        assert.strictEqual((await db('users')).length, 1);
        assert.deepStrictEqual((await this.http_get_json('/auth/status')).confirmed_with, ['password']);

        await this.confirm();
        await this.http_post_json('/auth/account/remove', {confirmation: 'DELETE'});
        assert.strictEqual((await db('users')).length, 0);
    });

    it('removing an account with only a password asks for the password alone', async function () {
        await this.sign_in({username: 'ann', password: 'anns-pass'});

        await this.http_post_json('/auth/account/remove', {confirmation: 'DELETE'});
        await assert_asked(this, 'Confirm it is you before removing your account', {next: config.pages.profile, reason: 'account_remove', factors: 1});

        await this.confirm({password: 'anns-pass'});
        await this.http_post_json('/auth/account/remove', {confirmation: 'DELETE'});
        assert.strictEqual((await db('users')).length, 0);
    });

    it('disconnecting a provider asks first', async function () {
        const {user_id} = await this.sign_in({username: 'ann', email: 'ann@authwall.test', password: 'anns-pass'});
        await link_github(user_id);

        await this.http_post_json('/auth/github/disconnect');
        await assert_asked(this, 'Confirm it is you before disconnecting an account', {next: config.pages.profile, reason: 'provider_disconnect', disconnect: const_user_identity.oauth_github});
        assert.strictEqual((await db('user_identities').where({type: const_user_identity.oauth_github})).length, 1);

        await this.confirm({password: 'anns-pass'});
        await this.http_post_json('/auth/github/disconnect');
        assert.strictEqual((await db('user_identities').where({type: const_user_identity.oauth_github})).length, 0);
    });

    it('a mistyped address the account never verified goes without asking', async function () {
        await this.sign_in({username: 'ann', password: 'anns-pass'});
        await this.http_post_json('/auth/email/add', {email: 'typo@authwall.test'});

        await this.http_post_json('/auth/email/remove');
        assert.strictEqual((await this.http_get_json('/auth/status')).error, null);
        assert.deepStrictEqual(await account_emails(), []);
    });

});
