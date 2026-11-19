const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const nock = require('nock').default;
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See authwall_restarts_with_new_settings.md.
describe('Authwall restarts with new access rules, then without them | stories', function () {

    beforeEach(function () {
        config.personal_access_tokens.enabled = true;
        config.websockets.enabled = true;
    });

    // A config change stands for the restart: the rules are read at startup.
    function restart_with_denied_emails(denied_emails) {
        config.access.denied_emails = denied_emails;
    }

    async function sign_in_with_a_token(ctx) {
        const {user_id} = await ctx.sign_in({email: 'ann@corp.test', password: 'anns-pass-123'});
        await ctx.mark_confirmed({reason: 'pat_create'});
        const {token} = await ctx.http_post_json('/auth/personal-access-tokens', {label: 'Script'});
        return {user_id, token};
    }

    async function doors(ctx, token) {
        const session = await ctx.client.get_json_no_redirects('/private');
        const bearer = await axios.get('/private', {baseURL: config.public_url, headers: {authorization: `Bearer ${token}`}, validateStatus: () => true});
        const sidecar = await ctx.client.get_json_no_redirects('/auth/sidecar').catch(e => e.response);
        const socket = await ctx.ws_roundtrip('/realtime', {headers: {Cookie: Array.from(ctx.client.cookies.values()).join('; '), Origin: config.public_url}});
        return {
            session: [session.status, session.headers.location ?? null],
            bearer: [bearer.status, typeof bearer.data === 'string' ? bearer.data : 'proxied'],
            sidecar: sidecar.status,
            socket: socket.opened,
        };
    }

    it('refuses Ann at every door while the rule stands, and lets the same session and token back once it goes', async function () {
        const {user_id, token} = await sign_in_with_a_token(this);
        const open = {session: [200, null], bearer: [200, 'proxied'], sidecar: 200, socket: true};
        assert.deepStrictEqual(await doors(this, token), open);

        restart_with_denied_emails(['ann@corp.test']);
        assert.deepStrictEqual(await doors(this, token), {
            session: [302, '/auth/sign-in?return=%2Fprivate'],
            bearer: [403, 'Email is not allowed'],
            sidecar: 401,
            socket: false,
        });
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: false, error: 'Email is not allowed'});
        assert.strictEqual(await db('sessions').where({user_id}).count({n: '*'}).first().then(v => Number(v.n)), 1);
        assert.strictEqual((await db('personal_access_tokens').where({user_id}).first()).revoked_at, null);

        restart_with_denied_emails([]);
        assert.deepStrictEqual(await doors(this, token), open);
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null});
    });

    it('lets Ann only sign out while refused: the denied address cannot be removed to get back in', async function () {
        const {user_id} = await sign_in_with_a_token(this);
        // GitHub stays a way in once the address is gone: nothing denies the
        // address it vouched for (AW-120).
        const now = new Date();
        await db('user_identities').insert({uid: random_uid_user_identity(), user_id, type: const_user_identity.oauth_github, value: '777', value_normalized: '777', created_at: now, updated_at: now, verified_at: now, provider_emails: JSON.stringify(['ann@github.test'])});
        await this.mark_confirmed({reason: 'email_remove'});
        restart_with_denied_emails(['ann@corp.test']);

        await this.http_post_json('/auth/email/remove', {});
        assert.ok(await db('user_identities').where({user_id, type: const_user_identity.email, value_normalized: 'ann@corp.test'}).first());
        assert.strictEqual((await this.client.get_json_no_redirects('/private')).status, 302);

        await this.http_post_json('/auth/sign-out', {});
        assert.strictEqual(await db('sessions').where({user_id}).count({n: '*'}).first().then(v => Number(v.n)), 0);
    });

    // Carol's account keeps no address of its own: she removed it, or Google
    // gave none. The doors judge the addresses Google vouched for at her last
    // Google sign-in, as that sign-in did (AW-120).
    describe('a Google account with no address of its own', function () {

        const OPEN = {session: [200, null], bearer: [200, 'proxied'], sidecar: 200, socket: true};

        beforeEach(function () {
            config.flows.google.enabled = true;
            config.flows.google.client_id = 'mocha_google_client_id';
            config.flows.google.redirect_url = 'mocha_google_redirect_url';
        });

        function restart_with_allowed_emails(allowed_emails) {
            config.access.allowed_emails = allowed_emails;
        }

        // Google signs Carol in, vouching for `email` or for none; the error
        // her browser is left with, null when she is in.
        async function google_sign_in(ctx, email) {
            nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
            nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, {sub: 'carol-google', name: 'Carol', picture: null, email, email_verified: Boolean(email)});
            await ctx.client.get_json_no_redirects('/auth/google');
            const {oauth_state} = await ctx.client.get_session();
            await ctx.client.get_json_no_redirects(urlmod('/auth/google/callback', {state: oauth_state, code: 'fake_code'}));
            return (await ctx.http_get_json('/auth/status')).error;
        }

        async function create_token(ctx) {
            await ctx.mark_confirmed({reason: 'pat_create'});
            const {token} = await ctx.http_post_json('/auth/personal-access-tokens', {label: 'Script'});
            return token;
        }

        // A sign-in from another browser, which keeps Carol's session aside.
        async function fresh_google_sign_in(ctx, email) {
            const cookies = new Map(ctx.client.cookies);
            ctx.client.cookies.clear();
            const error = await google_sign_in(ctx, email);
            ctx.client.cookies = cookies;
            return error;
        }

        it('Carol removed her address; dropped from the list, she is refused at every door, and let back once she is on it again', async function () {
            restart_with_allowed_emails(['carol@corp.test']);
            assert.strictEqual(await google_sign_in(this, 'carol@corp.test'), null);
            const token = await create_token(this);
            await this.mark_confirmed({reason: 'email_remove'});
            await this.http_post_json('/auth/email/remove', {});
            assert.deepStrictEqual((await this.http_get_json('/auth/status')).providers.map(v => v.type), [const_user_identity.oauth_google]);
            assert.deepStrictEqual(await doors(this, token), OPEN);

            restart_with_allowed_emails(['alice@corp.test']);
            assert.deepStrictEqual(await doors(this, token), {
                session: [302, '/auth/sign-in?return=%2Fprivate'],
                bearer: [403, 'Email is not allowed'],
                sidecar: 401,
                socket: false,
            });
            assert.strictEqual(await fresh_google_sign_in(this, 'carol@corp.test'), 'Email is not allowed');

            restart_with_allowed_emails(['alice@corp.test', 'carol@corp.test']);
            assert.deepStrictEqual(await doors(this, token), OPEN);
        });

        it('Google gave Carol no address; a list set later refuses her at every door, as it refuses her sign-in', async function () {
            assert.strictEqual(await google_sign_in(this, null), null);
            const token = await create_token(this);
            assert.deepStrictEqual(await doors(this, token), OPEN);

            restart_with_allowed_emails(['carol@corp.test']);
            assert.deepStrictEqual(await doors(this, token), {
                session: [302, '/auth/sign-in?return=%2Fprivate'],
                bearer: [403, 'A verified email is required'],
                sidecar: 401,
                socket: false,
            });
            assert.strictEqual(await fresh_google_sign_in(this, null), 'A verified email is required');

            restart_with_allowed_emails([]);
            assert.deepStrictEqual(await doors(this, token), OPEN);
        });

        it('an account from before the addresses were kept signs in with Google once, and its token works again', async function () {
            restart_with_allowed_emails(['carol@corp.test']);
            assert.strictEqual(await google_sign_in(this, 'carol@corp.test'), null);
            const token = await create_token(this);
            await this.mark_confirmed({reason: 'email_remove'});
            await this.http_post_json('/auth/email/remove', {});
            // The upgrade: nothing kept yet.
            await db('user_identities').where({type: const_user_identity.oauth_google}).update({provider_emails: null});
            assert.deepStrictEqual((await doors(this, token)).bearer, [403, 'A verified email is required']);

            assert.strictEqual(await google_sign_in(this, 'carol@corp.test'), null);
            assert.deepStrictEqual(await doors(this, token), OPEN);
        });

    });

});
