const assert = require('assert');
const bootstrap_users = require('../../../src/helpers/bootstrap_users');
const config = require('../../../config');
const db = require('../../../db');
const mock_discord = require('../../mock_discord');
const mock_facebook = require('../../mock_facebook');
const mock_github = require('../../mock_github');
const mock_google = require('../../mock_google');
const mock_microsoft = require('../../mock_microsoft');
const mock_twitter = require('../../mock_twitter');
const parse_authwall_seed = require('../../../src/helpers/parse/parse_authwall_seed');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const users_create = require('../../../src/helpers/models/users_create');

const PROVIDERS = [
    {name: 'google', authorize: '/auth/google', callback: '/auth/google/callback', mock: mock_google},
    {name: 'github', authorize: '/auth/github', callback: '/auth/github/callback', mock: mock_github},
    {name: 'microsoft', authorize: '/auth/microsoft', callback: '/auth/microsoft/callback', mock: mock_microsoft},
    {name: 'facebook', authorize: '/auth/facebook', callback: '/auth/facebook/callback', mock: mock_facebook},
    {name: 'twitter', authorize: '/auth/twitter', callback: '/auth/twitter/callback', mock: mock_twitter},
    {name: 'discord', authorize: '/auth/discord', callback: '/auth/discord/callback', mock: mock_discord},
];

describe('signup disabled', function () {
    beforeEach(function () {
        for (const provider of PROVIDERS) {
            const flow = config.flows[provider.name];
            flow.enabled = true;
            flow.client_id = `mocha_${provider.name}_client_id`;
            flow.client_secret = `mocha_${provider.name}_client_secret`;
            flow.redirect_url = `mocha_${provider.name}_redirect_url`;
        }
    });

    it('guards the shared user creation function', async function () {
        config.sign_up.enabled = false;
        await assert.rejects(users_create({password: 'unused-password', seed: true}), /Registration is closed/);
        assert.deepStrictEqual(await db('users'), []);
    });

    for (const fields of [{username: 'new-user'}, {email: 'new@example.com'}, {username: 'new-user', email: 'new@example.com'}]) {
        it(`refuses direct password signup for ${JSON.stringify(fields)}`, async function () {
            config.sign_up.enabled = false;
            await this.http_post_json('/auth/sign-up', {...fields, password: 'password123', password_confirm: 'password123', seed: true});
            assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
                authenticated: false, error: 'Registration is closed', actions: {can_sign_up: false},
            });
            assert.deepStrictEqual(await db('users'), []);
            assert.deepStrictEqual(await db('user_identities'), []);
            assert.strictEqual(this.sent_emails.length, 0);
        });
    }

    it('refuses signup before releasing a stale pending email', async function () {
        await this.add_user({email: 'new@example.com', verified: false});
        await db('user_identities').update({created_at: new Date(0)});
        const identities = await db('user_identities');
        config.sign_up.enabled = false;
        await this.http_post_json('/auth/sign-up', {email: 'new@example.com', password: 'password123', password_confirm: 'password123'});
        assert.deepStrictEqual(await db('user_identities'), identities);
        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Registration is closed');
    });

    it('allows existing password sign-in and advertises the policy to authenticated users', async function () {
        await this.add_user({username: 'existing', password: 'password123'});
        config.sign_up.enabled = false;
        await this.http_post_json('/auth/sign-in', {username: 'existing', password: 'password123'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: true, error: null, actions: {can_sign_up: false},
            flows: {password: {allow_username: true, allow_username_sign_up: false}},
        });
    });

    it('provisions missing seed users and adds identities while public signup is closed', async function () {
        const user = await this.add_user({email: 'existing@example.com', password: 'password123'});
        config.sign_up.enabled = false;
        config.seed_users = [
            {username: 'new-user', password: 'seed-secret', email: ['new@example.com']},
            {username: 'existing', email: ['existing@example.com']},
        ];
        await bootstrap_users();
        assert.strictEqual((await db('users')).length, 2);
        const username = await db('user_identities').where({value_normalized: 'existing'}).first();
        assert.strictEqual(username.user_id, user.user_id);
        assert.ok(await db('user_identities').where({value_normalized: 'new@example.com'}).first());
        assert.doesNotMatch(this.written_logs.join('\n'), /seed-secret/);
    });

    it('seeds two users on an empty database, lets both sign in, and refuses a third signup', async function () {
        config.sign_up.enabled = false;
        config.seed_users = parse_authwall_seed('alice:alice-password;bob:bob-password');
        await bootstrap_users();
        await bootstrap_users();
        assert.strictEqual((await db('users')).length, 2);
        assert.strictEqual((await db('user_identities')).length, 2);

        for (const seed_user of config.seed_users) {
            await this.http_post_json('/auth/sign-in', {username: seed_user.username, password: seed_user.password});
            const status = await this.http_get_json('/auth/status');
            assert.strictEqual(status.authenticated, true);
            assert.strictEqual(status.error, null);
            assert.ok(status.providers.some(v => v.value === seed_user.username));
            await this.http_post_json('/auth/sign-out');
        }

        await this.http_post_json('/auth/sign-up', {username: 'mallory', password: 'mallory-password', password_confirm: 'mallory-password', seed: true});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: false, error: 'Registration is closed'});
        assert.strictEqual((await db('users')).length, 2);
    });

    it('returns the usual magic-link response without mailing unknown addresses', async function () {
        await this.add_user({email: 'existing@example.com'});
        config.sign_up.enabled = false;
        const status = await this.http_get_json('/auth/status');
        const unknown = await this.client.post_json_no_redirects('/auth/magic-link/request', {_csrf: status.csrf_token, email: 'new@example.com'});
        assert.strictEqual(unknown.status, 302);
        assert.strictEqual(unknown.headers.location, '/auth/magic-link/sent?email=new%40example.com');
        assert.strictEqual((await db('magic_links')).length, 1);
        assert.strictEqual(this.sent_emails.length, 0);
        const existing = await this.client.post_json_no_redirects('/auth/magic-link/request', {_csrf: status.csrf_token, email: 'existing@example.com'});
        assert.strictEqual(existing.status, unknown.status);
        assert.strictEqual(existing.headers.location, '/auth/magic-link/sent?email=existing%40example.com');
        await this.wait_for_emails(1);
        assert.strictEqual(this.sent_emails.length, 1);
        const repeated = await this.client.post_json_no_redirects('/auth/magic-link/request', {_csrf: status.csrf_token, email: 'existing@example.com'});
        assert.strictEqual(repeated.status, existing.status);
        assert.strictEqual(repeated.headers.location, existing.headers.location);
        assert.strictEqual(this.sent_emails.length, 1);
    });

    for (const method of ['link', 'code']) {
        it(`rejects an old magic ${method} for a new user after signup closes`, async function () {
            await this.http_post_json('/auth/magic-link/request', {email: 'new@example.com'});
            const {link, code} = this.sent_emails[0].placeholders;
            config.sign_up.enabled = false;
            if (method === 'link') {
                const url = new URL(link);
                const preview = await this.http_get_json(`${url.pathname}/open${url.search}`);
                assert.strictEqual(preview.error, 'Registration is closed');
                await this.open_link(link);
            }
            else {
                await this.http_post_json('/auth/magic-link/confirm', {email: 'new@example.com', code});
            }
            assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: false, error: 'Registration is closed'});
            assert.deepStrictEqual(await db('users'), []);
            assert.deepStrictEqual(await db('user_identities'), []);
        });

        it(`allows an existing user to sign in by magic ${method}`, async function () {
            await this.add_user({email: 'existing@example.com'});
            config.sign_up.enabled = false;
            await this.http_post_json('/auth/magic-link/request', {email: 'existing@example.com'});
            await this.wait_for_emails(1);
            const {link, code} = this.sent_emails[0].placeholders;
            if (method === 'link') {
                await this.open_link(link);
            }
            else {
                await this.http_post_json('/auth/magic-link/confirm', {email: 'existing@example.com', code});
            }
            assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null});
            assert.strictEqual((await db('users')).length, 1);
        });

        it(`keeps pending identities intact when an old magic ${method} is refused`, async function () {
            await this.add_user({email: 'pending@example.com', password: 'password123', verified: false});
            await this.http_post_json('/auth/magic-link/request', {email: 'pending@example.com'});
            const {link, code} = this.sent_emails[0].placeholders;
            const identities = await db('user_identities');
            config.sign_up.enabled = false;
            if (method === 'link') {
                await this.open_link(link);
            }
            else {
                await this.http_post_json('/auth/magic-link/confirm', {email: 'pending@example.com', code});
            }
            assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, false);
            assert.deepStrictEqual(await db('user_identities'), identities);
            assert.strictEqual((await db('users')).length, 1);
        });
    }

    for (const provider of PROVIDERS) {
        it(`rejects new ${provider.name} accounts even when OAuth began before signup closed`, async function () {
            provider.mock();
            await this.client.get_json_no_redirects(provider.authorize);
            const session = await this.client.get_session();
            config.sign_up.enabled = false;
            await this.http_get_json(urlmod(provider.callback, {state: session.oauth_state, code: 'fake_code'}));
            assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: false, error: 'Registration is closed'});
            assert.deepStrictEqual(await db('users'), []);
            assert.deepStrictEqual(await db('user_identities'), []);
            assert.strictEqual(this.sent_emails.length, 0);
        });

        it(`allows an already linked ${provider.name} account to sign in`, async function () {
            provider.mock();
            await this.client.get_json_no_redirects(provider.authorize);
            const first_session = await this.client.get_session();
            await this.http_get_json(urlmod(provider.callback, {state: first_session.oauth_state, code: 'fake_code'}));
            const original = await this.http_get_json('/auth/status');
            assert.strictEqual(original.authenticated, true);
            await this.http_post_json('/auth/sign-out');
            config.sign_up.enabled = false;
            provider.mock();
            await this.client.get_json_no_redirects(provider.authorize);
            const session = await this.client.get_session();
            await this.http_get_json(urlmod(provider.callback, {state: session.oauth_state, code: 'fake_code'}));
            assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null, user_uid: original.user_uid});
            assert.strictEqual((await db('users')).length, 1);
        });
    }

    it('refuses OAuth signup without releasing a local pending email', async function () {
        await this.add_user({email: 'test@example.com', password: 'password123', verified: false});
        const identities = await db('user_identities');
        config.sign_up.enabled = false;
        mock_google();
        await this.client.get_json_no_redirects('/auth/google');
        const session = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/google/callback', {state: session.oauth_state, code: 'fake-code'}));
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: false, error: 'Registration is closed'});
        assert.deepStrictEqual(await db('user_identities'), identities);
    });

    it('allows a signed-in user to connect a provider while signup is closed', async function () {
        await this.sign_in({email: 'test@example.com', password: 'password123'});
        config.sign_up.enabled = false;
        mock_google();
        await this.client.get_json_no_redirects('/auth/google?connect=1');
        const session = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/google/callback', {state: session.oauth_state, code: 'fake-code'}));
        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, null);
        assert.ok(status.providers.some(v => v.type === 'oauth_google'));
        assert.strictEqual((await db('users')).length, 1);
    });
});
