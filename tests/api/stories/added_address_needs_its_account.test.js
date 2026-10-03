const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');

// See added_address_needs_its_account.md.
describe('An added address is confirmed only where its account is signed in | stories', function () {

    async function add_veras_address(_this, {github = true} = {}) {
        const {user_id} = await _this.sign_in({username: 'sam', password: 'sams-pass'});
        if (github) {
            const now = new Date();
            await db('user_identities').insert({uid: random_uid_user_identity(), user_id, type: const_user_identity.oauth_github, value: '777', value_normalized: '777', created_at: now, updated_at: now, verified_at: now});
        }
        await _this.http_post_json('/auth/email/add', {email: 'vera@corp.test'});
        const {link} = _this.sent_emails.find(v => v.placeholders?.link).placeholders;
        return {user_id, link: new URL(link).pathname + new URL(link).search};
    }

    function veras_address(user_id) {
        return db('user_identities').where({user_id, type: const_user_identity.email, value_normalized: 'vera@corp.test'}).first();
    }

    it('Vera\'s tap in another browser confirms nothing and sends her to sign in', async function () {
        const {user_id, link} = await add_veras_address(this);
        const sam = new Map(this.client.cookies);

        this.client.cookies.clear();
        const tap = await this.client.get_json_no_redirects(link);
        assert.strictEqual(tap.headers.location, `${config.pages.sign_in}?return=${encodeURIComponent(link)}`);
        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Sign in to confirm this address');
        assert.strictEqual((await veras_address(user_id)).verified_at, null);

        // Sam is still signed in; nothing changed hands.
        this.client.cookies = sam;
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);
    });

    it('Sam confirms it in his own browser', async function () {
        const {user_id, link} = await add_veras_address(this);
        const tap = await this.client.get_json_no_redirects(link);
        assert.strictEqual(tap.headers.location, config.pages.email_verify_success);
        assert.ok((await veras_address(user_id)).verified_at);
    });

    it('a tap elsewhere leaves the link for the owner, who signs in on the phone and taps again', async function () {
        const {user_id, link} = await add_veras_address(this);

        this.client.cookies.clear();
        await this.client.get_json_no_redirects(link);
        await this.http_post_json('/auth/sign-in', {username: 'sam', password: 'sams-pass'});
        const tap = await this.client.get_json_no_redirects(link);
        assert.strictEqual(tap.headers.location, config.pages.email_verify_success);
        assert.ok((await veras_address(user_id)).verified_at);
    });

    it('an account whose only way in is its password is handed over, as a sign-up is', async function () {
        const {link} = await add_veras_address(this, {github: false});
        this.client.cookies.clear();
        const tap = await this.client.get_json_no_redirects(link);
        assert.match(tap.headers.location, /^\/auth\/password-reset\/confirm\?token=/);
    });

});
