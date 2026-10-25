const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const nock = require('nock');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See pending_address_yields_to_its_owner.md.
describe('A pending address yields to the person who reads the mailbox | stories', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.client_secret = 'mocha_google_client_secret';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    afterEach(function () {
        nock.cleanAll();
    });

    // Mallory: a GitHub way in, and Vera's address added, pending; the link
    // it mailed to Vera is returned.
    async function mallory_adds_veras_address(ctx) {
        const {user_id} = await ctx.sign_in({username: 'mallory', password: 'mallorys-pass'});
        const now = new Date();
        await db('user_identities').insert({uid: random_uid_user_identity(), user_id, type: const_user_identity.oauth_github, value: '666', value_normalized: '666', created_at: now, updated_at: now, verified_at: now});
        await ctx.http_post_json('/auth/email/add', {email: 'vera@corp.test'});
        await ctx.wait_for_emails(1);
        const {link} = ctx.sent_emails.find(v => v.placeholders?.link).placeholders;
        ctx.client.cookies.clear();
        ctx.sent_emails.splice(0);
        return {mallory_id: user_id, link: new URL(link).pathname + new URL(link).search};
    }

    function veras_address() {
        return db('user_identities').where({type: const_user_identity.email, value_normalized: 'vera@corp.test'}).first();
    }

    async function age_veras_address(minutes) {
        const then = new Date(Date.now() - minutes*60*1000);
        await db('user_identities').where({value_normalized: 'vera@corp.test'}).update({created_at: then});
        await db('email_verify_tokens').where({email_normalized: 'vera@corp.test'}).update({expires_at: then});
    }

    const sign_up = {email: 'vera@corp.test', password: 'veras-pass-123', password_confirm: 'veras-pass-123'};

    it('moves the address to Vera on Vera\'s magic link', async function () {
        const {mallory_id} = await mallory_adds_veras_address(this);
        await this.http_post_json('/auth/magic-link/request', {email: 'vera@corp.test'});
        await this.wait_for_emails(1);
        await this.open_link(urlmod('/auth/magic-link/confirm', {token: this.sent_emails[0].placeholders.token}));

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null});
        const address = await veras_address();
        assert.notStrictEqual(address.user_id, mallory_id);
        assert.ok(address.verified_at);
        assert.ok(await db('user_identities').where({user_id: mallory_id, type: const_user_identity.oauth_github}).first());
        assert.partialDeepStrictEqual(await db('auth_events').where({user_id: mallory_id, event_type: 'identity_removed'}).first(), {identity_value_normalized: 'vera@corp.test', custom: JSON.stringify({reason: 'pending_email_proven_elsewhere'})});
    });

    it('moves the address to Vera on Vera\'s Google, which vouches for it', async function () {
        const {mallory_id} = await mallory_adds_veras_address(this);
        nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
        nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {sub: 'google-vera', name: 'Vera', email: 'vera@corp.test', email_verified: true});
        await this.client.get_json_no_redirects('/auth/google');
        const {oauth_state} = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/google/callback', {code: 'fake_code', state: oauth_state}));

        const address = await veras_address();
        assert.notStrictEqual(address.user_id, mallory_id);
        assert.ok(address.verified_at);
        assert.ok(await db('user_identities').where({user_id: address.user_id, type: const_user_identity.oauth_google}).first());
    });

    it('frees the address from the mailed link\'s "Not my account", and Vera signs up with it', async function () {
        const {mallory_id, link} = await mallory_adds_veras_address(this);
        assert.partialDeepStrictEqual(await this.http_get_json(`${new URL(link, config.public_url).pathname}/open${new URL(link, config.public_url).search}`), {sign_in: true, not_mine: true});

        const {csrf_token} = await this.http_get_json('/auth/status');
        const freed = await this.client.post_json_no_redirects(`${new URL(link, config.public_url).pathname}/open`, {token: new URL(link, config.public_url).searchParams.get('token'), not_mine: '1', _csrf: csrf_token});
        assert.strictEqual(freed.headers.location, config.pages.sign_up);
        assert.strictEqual(await veras_address(), undefined);

        await this.http_post_json('/auth/sign-up', sign_up);
        const address = await veras_address();
        assert.notStrictEqual(address.user_id, mallory_id);
    });

    it('lets a sign-up take an address nobody confirmed within the window, and not before', async function () {
        const {mallory_id} = await mallory_adds_veras_address(this);
        await this.http_post_json('/auth/sign-up', sign_up);
        assert.strictEqual((await veras_address()).user_id, mallory_id);
        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Email already exists');

        await age_veras_address(config.confirm_email.expires_minutes + 1);
        await this.http_post_json('/auth/sign-up', sign_up);
        const address = await veras_address();
        assert.notStrictEqual(address.user_id, mallory_id);
        assert.strictEqual(address.verified_at, null);
        assert.partialDeepStrictEqual(await db('auth_events').where({user_id: mallory_id, event_type: 'identity_removed'}).first(), {custom: JSON.stringify({reason: 'pending_email_stale'})});
    });

    it('never moves a confirmed address', async function () {
        const {user_id} = await this.sign_in({email: 'vera@corp.test', password: 'veras-pass-123'});
        this.client.cookies.clear();
        await age_veras_address(config.confirm_email.expires_minutes + 1);
        await this.http_post_json('/auth/sign-up', {...sign_up, password: 'someone-else-1', password_confirm: 'someone-else-1'});
        assert.strictEqual((await veras_address()).user_id, user_id);
        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Email already exists');
    });

});
