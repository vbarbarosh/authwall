const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');

// See a_username_account_under_a_new_email_rule.md.
describe('A username account under a new email rule | stories', function () {

    const OPEN = {session: [200, null], bearer: [200, 'proxied'], sidecar: 200, socket: true};
    const REFUSED = {session: [302, '/auth/sign-in?return=%2Fprivate'], bearer: [403, 'A verified email is required'], sidecar: 401, socket: false};

    beforeEach(function () {
        config.personal_access_tokens.enabled = true;
        config.websockets.enabled = true;
    });

    // A config change stands for the restart: the rules are read at startup.
    function restart_with_allowed_domains(allowed_domains) {
        config.access.allowed_domains = allowed_domains;
    }

    async function sign_in_with_a_token(ctx, params) {
        const {user_id} = await ctx.sign_in(params);
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

    it('refuses Sam\'s session, token, sidecar and socket as it refuses his sign-in, and lets them back once the rule goes', async function () {
        const {user_id, token} = await sign_in_with_a_token(this, {username: 'sam', password: 'sams-pass-123'});
        assert.deepStrictEqual(await doors(this, token), OPEN);

        restart_with_allowed_domains(['corp.test']);
        assert.deepStrictEqual(await doors(this, token), REFUSED);
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: false, error: 'A verified email is required'});
        assert.strictEqual(await db('sessions').where({user_id}).count({n: '*'}).first().then(v => Number(v.n)), 1);
        assert.strictEqual((await db('personal_access_tokens').where({user_id}).first()).revoked_at, null);

        restart_with_allowed_domains([]);
        assert.deepStrictEqual(await doors(this, token), OPEN);
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null});

        // A new sign-in gets the same answer, given as a wrong password is.
        restart_with_allowed_domains(['corp.test']);
        await this.http_post_json('/auth/sign-out', {});
        await this.http_post_json('/auth/sign-in', {username: 'sam', password: 'sams-pass-123'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: false, error: 'Invalid username or password'});
    });

    describe('with Google enabled', function () {

        beforeEach(function () {
            config.flows.google.enabled = true;
            config.flows.google.client_id = 'mocha_google_client_id';
            config.flows.google.redirect_url = 'mocha_google_redirect_url';
        });

        it('keeps Ann\'s session while her Google account is a way in, and refuses it once Google is disabled', async function () {
            const {user_id, token} = await sign_in_with_a_token(this, {username: 'ann', password: 'anns-pass-123'});
            const now = new Date();
            // Google vouched for ann@corp.test at her last Google sign-in (AW-120).
            await db('user_identities').insert({uid: random_uid_user_identity(), user_id, type: const_user_identity.oauth_google, value: '1001', value_normalized: '1001', created_at: now, updated_at: now, verified_at: now, provider_emails: JSON.stringify(['ann@corp.test'])});

            restart_with_allowed_domains(['corp.test']);
            assert.deepStrictEqual(await doors(this, token), OPEN);

            // Google is her way to meet the rule: it stays connected.
            await this.http_post_json('/auth/google/disconnect');
            assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: 'Cannot disconnect: a verified email is required to sign in'});
            assert.ok(await db('user_identities').where({user_id, type: const_user_identity.oauth_google}).first());
            assert.deepStrictEqual(await doors(this, token), OPEN);

            // Her username and password get the same answer.
            await this.http_post_json('/auth/sign-out', {});
            await this.http_post_json('/auth/sign-in', {username: 'ann', password: 'anns-pass-123'});
            assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null});
            assert.deepStrictEqual(await doors(this, token), OPEN);

            config.flows.google.enabled = false;
            assert.deepStrictEqual(await doors(this, token), REFUSED);
        });

    });

    it('holds Pat at confirmation, not refused, until her address is confirmed', async function () {
        config.confirm_email.required = true;
        restart_with_allowed_domains(['corp.test']);
        const {user_id} = await this.add_user({email: 'pat@corp.test', verified: false, password: 'pats-pass-123'});
        await this.http_post_json('/auth/sign-in', {username: 'pat@corp.test', password: 'pats-pass-123'});

        const held = await this.client.get_json_no_redirects('/private');
        assert.deepStrictEqual([held.status, held.headers.location], [302, `${config.pages.email_verify_request}?return=%2Fprivate`]);
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true});
        await this.http_post_json('/auth/email-verify/request', {});
        await this.wait_for_emails(1);

        await db('user_identities').where({user_id, type: const_user_identity.email}).update({verified_at: new Date()});
        assert.strictEqual((await this.client.get_json_no_redirects('/private')).status, 200);
    });

});
