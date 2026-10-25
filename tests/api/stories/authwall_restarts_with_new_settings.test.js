const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');

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
        // GitHub stays a way in once the address is gone, and nothing denies it.
        const now = new Date();
        await db('user_identities').insert({uid: random_uid_user_identity(), user_id, type: const_user_identity.oauth_github, value: '777', value_normalized: '777', created_at: now, updated_at: now, verified_at: now});
        await this.mark_confirmed({reason: 'email_remove'});
        restart_with_denied_emails(['ann@corp.test']);

        await this.http_post_json('/auth/email/remove', {});
        assert.ok(await db('user_identities').where({user_id, type: const_user_identity.email, value_normalized: 'ann@corp.test'}).first());
        assert.strictEqual((await this.client.get_json_no_redirects('/private')).status, 302);

        await this.http_post_json('/auth/sign-out', {});
        assert.strictEqual(await db('sessions').where({user_id}).count({n: '*'}).first().then(v => Number(v.n)), 0);
    });

});
