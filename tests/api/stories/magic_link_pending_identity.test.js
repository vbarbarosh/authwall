const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// Anyone can sign up with anyone's e-mail and leave it unverified. A magic
// link for that address must not sign its recipient into the squatter's
// account — and must not verify the squatter's claim either.
describe('Magic link for an address registered but unverified by someone else | stories', function () {

    async function squat(_this) {
        config.flows.password.min_password_length = 4;
        await _this.http_post_json('/auth/sign-up', {username: 'attacker', email: 'victim@authwall.test', password: 'attk-pw', password_confirm: 'attk-pw'});
        const attacker = await _this.http_get_json('/auth/status');
        assert.strictEqual(attacker.authenticated, true);
        await _this.http_post_json('/auth/sign-out');
        _this.client.cookies.clear();
        _this.sent_emails.splice(0);
        return attacker.user_uid;
    }

    it('refuses the link, keeps the visitor signed out, and leaves the identity unverified', async function () {
        const attacker_uid = await squat(this);

        await this.http_post_json('/auth/magic-link/request', {email: 'victim@authwall.test'});
        await this.wait_for_emails(1);
        const {token} = this.sent_emails[0].placeholders;
        await this.http_get_json(urlmod('/auth/magic-link/confirm', {token}));

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, false);
        assert.match(status.error, /registered but not yet verified/);
        assert.notStrictEqual(status.user_uid, attacker_uid);

        const ident = await db('user_identities').where({type: const_user_identity.email, value_normalized: 'victim@authwall.test'}).first();
        assert.strictEqual(ident.verified_at, null);
    });

    it('refuses the code path the same way', async function () {
        await squat(this);

        await this.http_post_json('/auth/magic-link/request', {email: 'victim@authwall.test'});
        await this.wait_for_emails(1);
        const {code} = this.sent_emails[0].placeholders;
        await this.http_post_json('/auth/magic-link/confirm', {email: 'victim@authwall.test', code});

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, false);
        assert.match(status.error, /registered but not yet verified/);
    });

    it('still signs in the owner of a verified address', async function () {
        await this.add_user({email: 'owner@authwall.test', verified: true});

        await this.http_post_json('/auth/magic-link/request', {email: 'owner@authwall.test'});
        await this.wait_for_emails(1);
        const {token} = this.sent_emails[0].placeholders;
        await this.http_get_json(urlmod('/auth/magic-link/confirm', {token}));

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);
    });

});
