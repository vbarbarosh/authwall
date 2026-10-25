const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const mock_facebook = require('../../mock_facebook');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See facebook_address_pending_until_confirmed.md.
describe('Facebook\'s address is pending until Authwall confirms it | stories', function () {

    beforeEach(function () {
        config.flows.facebook.enabled = true;
        config.flows.facebook.client_id = 'mocha_facebook_client_id';
        config.flows.facebook.client_secret = 'mocha_facebook_client_secret';
        config.flows.facebook.redirect_url = 'mocha_facebook_redirect_url';
    });

    // Under an allow list Authwall resolves confirmation to required, or
    // refuses to start (allow_list_needs_confirmed_email.test.js).
    function allow_corp_test() {
        config.access.allowed_domains = ['corp.test'];
        config.confirm_email.required = true;
    }

    async function sign_in_via_facebook(ctx, user_info, route = '/auth/facebook') {
        mock_facebook(user_info);
        await ctx.client.get_json_no_redirects(route);
        const {oauth_state} = await ctx.client.get_session();
        await ctx.http_get_json(urlmod('/auth/facebook/callback', {code: 'fake_code', state: oauth_state}));
        return ctx.http_get_json('/auth/status');
    }

    function address_of(email) {
        return db('user_identities').where({type: const_user_identity.email, value_normalized: email}).first();
    }

    async function sidecar_status(ctx) {
        try {
            return (await ctx.client.get_json_no_redirects('/auth/sidecar')).status;
        }
        catch (error) {
            return error.response.status;
        }
    }

    async function open_mailed_link(ctx) {
        await ctx.wait_for_emails(1);
        const {link} = ctx.sent_emails.find(v => v.placeholders?.link).placeholders;
        await ctx.open_link(new URL(link).pathname + new URL(link).search);
    }

    it('stores Ann\'s address pending and mails the link with the welcome', async function () {
        const status = await sign_in_via_facebook(this, {email: 'ann@corp.test'});
        assert.partialDeepStrictEqual(status, {error: null, authenticated: true});
        assert.strictEqual((await address_of('ann@corp.test')).verified_at, null);

        await this.wait_for_emails(1);
        assert.strictEqual(this.sent_emails[0].name, const_email.welcome_and_confirm_email);
        assert.strictEqual(this.sent_emails[0].to, 'Test User <ann@corp.test>');

        await open_mailed_link(this);
        assert.ok((await address_of('ann@corp.test')).verified_at);
    });

    it('holds Ann at confirmation under an allow list until the link is opened', async function () {
        allow_corp_test();
        await sign_in_via_facebook(this, {email: 'ann@corp.test'});
        assert.strictEqual(await sidecar_status(this), 403);

        await open_mailed_link(this);
        assert.strictEqual(await sidecar_status(this), 200);
    });

    it('admits Ann as before on the next Facebook sign-in, with no new mail', async function () {
        allow_corp_test();
        await sign_in_via_facebook(this, {email: 'ann@corp.test'});
        await open_mailed_link(this);
        this.client.cookies.clear();
        this.sent_emails.splice(0);

        const status = await sign_in_via_facebook(this, {email: 'ann@corp.test'});
        assert.partialDeepStrictEqual(status, {error: null, authenticated: true});
        assert.strictEqual(await sidecar_status(this), 200);
        assert.deepStrictEqual(this.sent_emails.map(v => v.name), [const_email.new_sign_in]);
    });

    it('never admits Mallory under boss@corp.test: the link goes to boss', async function () {
        allow_corp_test();
        await sign_in_via_facebook(this, {id: 'mallory-1', email: 'boss@corp.test'});
        assert.strictEqual(await sidecar_status(this), 403);

        await this.wait_for_emails(1);
        assert.deepStrictEqual(this.sent_emails.map(v => v.to), ['Test User <boss@corp.test>']);
        assert.strictEqual((await address_of('boss@corp.test')).verified_at, null);
    });

    it('leaves an address another account holds with it, and mails nothing', async function () {
        allow_corp_test();
        await this.sign_in({email: 'boss@corp.test', password: 'boss-pass'});
        const boss = await address_of('boss@corp.test');
        this.client.cookies.clear();
        this.sent_emails.splice(0);

        await sign_in_via_facebook(this, {id: 'mallory-1', email: 'boss@corp.test'});
        assert.strictEqual(await sidecar_status(this), 403);
        assert.deepStrictEqual(await address_of('boss@corp.test'), boss);
        assert.deepStrictEqual(this.sent_emails, []);
    });

    for (const [label, user_info, error] of [
        ['outside the allow list', {email: 'ann@outside.test'}, 'Email domain is not allowed'],
        ['none at all', {email: undefined}, 'A verified email is required'],
    ]) {
        it(`refuses an address ${label} before any account is made`, async function () {
            allow_corp_test();
            const status = await sign_in_via_facebook(this, user_info);
            assert.partialDeepStrictEqual(status, {authenticated: false, error});
            assert.deepStrictEqual(await db('user_identities').where({type: const_user_identity.oauth_facebook}), []);
            assert.deepStrictEqual(this.sent_emails, []);
        });
    }

    it('does not bring the address along on a connect, and the confirmation still names it', async function () {
        await this.sign_in({email: 'ann@corp.test', password: 'anns-pass'});
        const {confirmation} = await sign_in_via_facebook(this, {email: 'ann.fb@corp.test'}, '/auth/facebook?connect=1');
        assert.deepStrictEqual(confirmation.provider_emails, ['ann.fb@corp.test']);

        await this.mark_confirmed(confirmation);
        await sign_in_via_facebook(this, {email: 'ann.fb@corp.test'}, '/auth/facebook?connect=1');
        assert.ok(await db('user_identities').where({type: const_user_identity.oauth_facebook}).first());
        assert.strictEqual(await address_of('ann.fb@corp.test'), undefined);
    });

});
