const assert = require('assert');
const config = require('../../../config');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_auth_event_status = require('../../../src/helpers/const/const_auth_event_status');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');

describe('Username authentication with email access rules', function () {

    const policies = [
        {key: 'allowed_emails', values: ['allowed@authwall.test']},
        {key: 'allowed_domains', values: ['authwall.test']},
        {key: 'denied_emails', values: ['blocked@authwall.test']},
        {key: 'denied_domains', values: ['blocked.test']},
    ];

    for (const {key, values} of policies) {
        for (const required of [false, true]) {
            it(`blocks username registration under ${key}, verification=${required}`, async function () {
                config.access[key] = values;
                config.confirm_email.required = required;

                // Supplying an allowed but unverified email alongside the
                // username must not provide another way around the policy.
                for (const email of [undefined, 'allowed@authwall.test']) {
                    await this.http_post_json('/auth/sign-up', {
                        username: 'outsider', email,
                        password: 'password123', password_confirm: 'password123',
                    });
                    assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
                        authenticated: false,
                        error: 'Username sign-up is disabled when email access rules are configured',
                        flows: {password: {allow_username: true, allow_username_sign_up: false}},
                    });
                    assert.strictEqual((await db('users')).length, 0);
                    const upstream = await this.client.get_json_no_redirects('/protected');
                    assert.strictEqual(upstream.status, 302);
                    assert.ok(upstream.headers.location.startsWith('/auth/sign-in'));
                }
            });
        }

        it(`requires a verified email for existing username accounts under ${key}`, async function () {
            config.access[key] = values;
            config.confirm_email.required = false;
            const users = [
                await this.add_user({username: 'noemail', password: 'password123'}),
                await this.add_user({username: 'pending', email: 'allowed@authwall.test', verified: false, password: 'password123'}),
            ];

            for (const {username, user_id} of users) {
                await db('auth_events').del();
                await this.http_post_json('/auth/sign-in', {username, password: 'password123'});
                assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
                    authenticated: false, error: 'Invalid username or password',
                });
                // A denied sign-in must be attributable: the account and the
                // identifier that was presented, not just a bare access-rule hit.
                assert.partialDeepStrictEqual(await db('auth_events').where({event_type: const_auth_event.sign_in}), [{
                    event_status: const_auth_event_status.failure,
                    user_id,
                    identity_type: const_user_identity.username,
                    identity_value: username,
                    custom: JSON.stringify({method: 'sign_in_form', reason: 'no_verified_email'}),
                }]);
            }
        });
    }

    for (const {key, values, email, reason} of [
        {key: 'allowed_emails', values: ['other@authwall.test'], email: 'allowed@authwall.test', reason: 'Email is not allowed'},
        {key: 'allowed_domains', values: ['other.test'], email: 'allowed@authwall.test', reason: 'Email domain is not allowed'},
        {key: 'denied_emails', values: ['allowed@authwall.test'], email: 'allowed@authwall.test', reason: 'Email is not allowed'},
        {key: 'denied_domains', values: ['authwall.test'], email: 'allowed@authwall.test', reason: 'Email domain is not allowed'},
    ]) {
        it(`rejects a verified email that fails ${key}`, async function () {
            config.access[key] = values;
            const {user_id} = await this.add_user({username: 'member', email, password: 'password123'});
            await this.http_post_json('/auth/sign-in', {username: 'member', password: 'password123'});
            assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
                authenticated: false, error: 'Invalid username or password',
            });
            assert.strictEqual((await db('auth_events').where({event_type: 'sign_in', event_status: 'success'})).length, 0);
            // Which rule turned the account away is recorded, never answered.
            assert.partialDeepStrictEqual(await db('auth_events').where({event_type: const_auth_event.sign_in}), [{
                event_status: const_auth_event_status.failure,
                user_id,
                identity_type: const_user_identity.username,
                identity_value: 'member',
                custom: JSON.stringify({method: 'sign_in_form', reason: 'email_not_authorized', email, error: reason}),
            }]);
        });
    }

    for (const required of [false, true]) {
        it(`allows username sign-in with an eligible verified email, verification=${required}`, async function () {
            config.access.allowed_emails = ['allowed@authwall.test'];
            config.confirm_email.required = required;
            await this.sign_in({username: 'member', email: 'allowed@authwall.test', password: 'password123'});
            const upstream = await this.http_get_json('/protected');
            assert.ok(upstream.headers['x-auth-user']);
        });
    }

    it('checks every verified email rather than stopping at the first allowed one', async function () {
        config.access.allowed_domains = ['authwall.test'];
        const {user_id} = await this.add_user({username: 'member', email: 'allowed@authwall.test', password: 'password123'});
        const now = new Date();
        await db('user_identities').insert({
            uid: random_uid_user_identity(), user_id, type: 'email',
            value: 'other@outside.test', value_normalized: 'other@outside.test',
            created_at: now, updated_at: now, verified_at: now,
        });
        await this.http_post_json('/auth/sign-in', {username: 'member', password: 'password123'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: false, error: 'Invalid username or password',
        });
        assert.partialDeepStrictEqual(await db('auth_events').where({event_type: const_auth_event.sign_in}), [{
            event_status: const_auth_event_status.failure,
            custom: JSON.stringify({
                method: 'sign_in_form', reason: 'email_not_authorized',
                email: 'other@outside.test', error: 'Email domain is not allowed',
            }),
        }]);
    });

    it('answers a denied account exactly as it answers a wrong password', async function () {
        // Otherwise the sign-in form confirms a guessed password to an
        // attacker who can never use it here, but can try it elsewhere.
        config.access.allowed_domains = ['authwall.test'];
        await this.add_user({username: 'member', email: 'member@outside.test', password: 'password123'});

        const answers = [];
        for (const password of ['password123', 'wrong']) {
            await this.http_post_json('/auth/sign-in', {username: 'member', password});
            answers.push(await this.http_get_json('/auth/status'));
        }
        assert.partialDeepStrictEqual(answers[0], {authenticated: false, error: 'Invalid username or password'});
        assert.deepStrictEqual(answers[0], answers[1]);

        // A username nobody registered must be indistinguishable too.
        await this.http_post_json('/auth/sign-in', {username: 'ghost', password: 'password123'});
        assert.deepStrictEqual(await this.http_get_json('/auth/status'), answers[0]);
    });

    it('preserves unrestricted username registration and upstream access', async function () {
        await this.http_post_json('/auth/sign-up', {
            username: 'member', password: 'password123', password_confirm: 'password123',
        });
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null});
        assert.ok((await this.http_get_json('/protected')).headers['x-auth-user']);
    });
});
