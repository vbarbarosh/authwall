const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');
const {personal_access_token_hash} = require('../../../src/helpers/personal_access_tokens');

describe('personal_access_tokens', function () {

    describe('disabled', function () {
        beforeEach(function () {
            config.personal_access_tokens.enabled = false;
        });

        it('does not expose token UI state by default', async function () {
            await this.sign_in({username: 'mocha', password: 'pass123'});

            const status = await this.http_get_json('/auth/status');

            assert.strictEqual(status.actions.can_manage_personal_access_tokens, false);
            assert.strictEqual('personal_access_tokens' in status, false);
        });
    });

    describe('enabled', function () {

        beforeEach(function () {
            config.personal_access_tokens.enabled = true;
        });

        it('creates a token, stores only its hash, and lists metadata', async function () {
            await this.sign_in({username: 'mocha', password: 'pass123'});

            const created = await this.http_post_json('/auth/personal-access-tokens', {
                label: 'My Laptop',
                expires_days: '30',
            });

            assert.match(created.token, /^awp_/);
            assert.partialDeepStrictEqual(created.personal_access_token, {
                label: 'My Laptop',
                token_prefix: created.token.slice(0, 16),
                revoked_at: null,
                last_used_at: null,
            });

            const row = await db('personal_access_tokens').where({uid: created.personal_access_token.uid}).first();
            assert.strictEqual(row.label, 'My Laptop');
            assert.strictEqual(row.token_hash, personal_access_token_hash(created.token));
            assert.strictEqual(row.token_prefix, created.token.slice(0, 16));
            assert.ok(!JSON.stringify(row).includes(created.token));

            const status = await this.http_get_json('/auth/status');
            assert.strictEqual(status.actions.can_manage_personal_access_tokens, true);
            assert.partialDeepStrictEqual(status.personal_access_tokens[0], {
                uid: created.personal_access_token.uid,
                label: 'My Laptop',
                token_prefix: created.token.slice(0, 16),
            });
            assert.strictEqual('token_hash' in status.personal_access_tokens[0], false);
        });

        it('records auth events for create and revoke', async function () {
            await db('auth_events').del();
            await this.sign_in({username: 'mocha', password: 'pass123'});

            const created = await this.http_post_json('/auth/personal-access-tokens', {
                label: 'CLI',
            });
            await this.http_post_json('/auth/personal-access-tokens/revoke', {
                uid: created.personal_access_token.uid,
            });

            const events = await db('auth_events').whereIn('event_type', [
                const_auth_event.personal_access_token_created,
                const_auth_event.personal_access_token_revoked,
            ]).orderBy('id');

            assert.deepStrictEqual(events.map(v => v.event_type), [
                const_auth_event.personal_access_token_created,
                const_auth_event.personal_access_token_revoked,
            ]);
            assert.deepStrictEqual(events.map(v => v.event_status), ['success', 'success']);
            assert.partialDeepStrictEqual(JSON.parse(events[0].custom), {
                personal_access_token_uid: created.personal_access_token.uid,
                label: 'CLI',
            });
            assert.partialDeepStrictEqual(JSON.parse(events[1].custom), {
                personal_access_token_uid: created.personal_access_token.uid,
            });
        });

        it('rejects revoking an unknown token uid', async function () {
            await this.sign_in({username: 'mocha', password: 'pass123'});

            await this.http_post_json('/auth/personal-access-tokens/revoke', {
                uid: 'awpat_does_not_exist',
            });

            const status = await this.http_get_json('/auth/status');
            assert.strictEqual(status.error, 'Personal access token not found');

            const event = await db('auth_events')
                .where({event_type: const_auth_event.personal_access_token_revoked})
                .orderBy('id', 'desc')
                .first();
            assert.strictEqual(event.event_status, 'failure');
            assert.partialDeepStrictEqual(JSON.parse(event.custom), {
                personal_access_token_uid: 'awpat_does_not_exist',
                reason: 'not_found',
            });
        });

        it('rejects revoking an already-revoked token', async function () {
            await this.sign_in({username: 'mocha', password: 'pass123'});
            const created = await this.http_post_json('/auth/personal-access-tokens', {
                label: 'CLI',
            });
            await this.http_post_json('/auth/personal-access-tokens/revoke', {
                uid: created.personal_access_token.uid,
            });

            await this.http_post_json('/auth/personal-access-tokens/revoke', {
                uid: created.personal_access_token.uid,
            });

            const status = await this.http_get_json('/auth/status');
            assert.strictEqual(status.error, 'Personal access token already revoked');

            const event = await db('auth_events')
                .where({event_type: const_auth_event.personal_access_token_revoked})
                .orderBy('id', 'desc')
                .first();
            assert.strictEqual(event.event_status, 'noop');
            assert.partialDeepStrictEqual(JSON.parse(event.custom), {
                personal_access_token_uid: created.personal_access_token.uid,
                reason: 'already_revoked',
            });
        });

        it('does not let one user revoke another user\'s token', async function () {
            const cookies_a = new Map();
            const cookies_b = new Map();

            this.client.cookies = cookies_a;
            const {user_id: owner_id} = await this.sign_in({username: 'mocha', password: 'pass123'});
            const created = await this.http_post_json('/auth/personal-access-tokens', {
                label: 'Mocha laptop',
            });

            this.client.cookies = cookies_b;
            const {user_id: actor_id} = await this.sign_in({username: 'mocha2', password: 'pass123'});
            await this.http_post_json('/auth/personal-access-tokens/revoke', {
                uid: created.personal_access_token.uid,
            });

            const status = await this.http_get_json('/auth/status');
            assert.strictEqual(status.error, 'Personal access token not found');

            const row = await db('personal_access_tokens').where({uid: created.personal_access_token.uid}).first();
            assert.strictEqual(row.revoked_at, null);

            const event = await db('auth_events')
                .where({event_type: const_auth_event.personal_access_token_revoked})
                .orderBy('id', 'desc')
                .first();
            assert.strictEqual(event.event_status, 'failure');
            assert.strictEqual(event.user_id, actor_id, 'auth event should record the actor');
            assert.partialDeepStrictEqual(JSON.parse(event.custom), {
                personal_access_token_uid: created.personal_access_token.uid,
                reason: 'belongs_to_another_user',
                target_user_id: owner_id,
            });
        });

        it('authenticates proxied requests with a bearer token', async function () {
            const {user_id} = await this.sign_in({username: 'mocha', password: 'pass123'});
            const user = await db('users').where({id: user_id}).first();
            const created = await this.http_post_json('/auth/personal-access-tokens', {
                label: 'Desktop app',
            });

            const r = await axios.get('/private', {
                baseURL: config.public_url,
                headers: {
                    authorization: `Bearer ${created.token}`,
                },
                timeout: 2000,
            });

            assert.partialDeepStrictEqual(r.data, {
                echo_server: 'authwall_testing_echo_server',
                method: 'GET',
                url: '/private',
                headers: {
                    'x-auth-user': user.uid,
                },
            });
            assert.strictEqual('authorization' in r.data.headers, false);

            const row = await db('personal_access_tokens').where({uid: created.personal_access_token.uid}).first();
            assert.ok(row.last_used_at);
            assert.strictEqual(row.last_used_ip, '127.0.0.1');
        });

        it('rejects revoked bearer tokens', async function () {
            await this.sign_in({username: 'mocha', password: 'pass123'});
            const created = await this.http_post_json('/auth/personal-access-tokens', {
                label: 'Old app',
            });
            await this.http_post_json('/auth/personal-access-tokens/revoke', {
                uid: created.personal_access_token.uid,
            });

            const r = await axios.get('/private', {
                baseURL: config.public_url,
                headers: {
                    authorization: `Bearer ${created.token}`,
                },
                timeout: 2000,
                validateStatus: v => v < 500,
            });

            assert.strictEqual(r.status, 401);
            assert.strictEqual(r.data, 'Invalid personal access token');
        });

        describe('GET /auth/status with bearer auth', function () {

            it('returns the authenticated payload for the token owner', async function () {
                const {user_id} = await this.sign_in({username: 'mocha', password: 'pass123'});
                const user = await db('users').where({id: user_id}).first();
                const created = await this.http_post_json('/auth/personal-access-tokens', {
                    label: 'Desktop app',
                });

                const r = await axios.get('/auth/status', {
                    baseURL: config.public_url,
                    headers: {
                        authorization: `Bearer ${created.token}`,
                    },
                    timeout: 2000,
                });

                assert.partialDeepStrictEqual(r.data, {
                    authenticated: true,
                    user_uid: user.uid,
                    user_slug: user.slug,
                    current_session_uid: null,
                    csrf_token: null,
                });
                assert.ok(Array.isArray(r.data.personal_access_tokens));
                assert.ok(r.data.personal_access_tokens.some(t => t.uid === created.personal_access_token.uid));
            });

            it('rejects with 401 when the bearer token is invalid', async function () {
                const r = await axios.get('/auth/status', {
                    baseURL: config.public_url,
                    headers: {
                        authorization: 'Bearer awp_definitely_not_a_real_token_value_for_testing_123',
                    },
                    timeout: 2000,
                    validateStatus: v => v < 500,
                });

                assert.strictEqual(r.status, 401);
                assert.strictEqual(r.data, 'Invalid personal access token');
            });

            it('returns the anonymous payload when no Authorization header is sent', async function () {
                const status = await this.http_get_json('/auth/status');
                assert.strictEqual(status.authenticated, false);
            });

            it('does not include revoked tokens in the status payload', async function () {
                await this.sign_in({username: 'mocha', password: 'pass123'});
                const keep = await this.http_post_json('/auth/personal-access-tokens', {
                    label: 'Keep me',
                });
                const drop = await this.http_post_json('/auth/personal-access-tokens', {
                    label: 'Revoke me',
                });
                await this.http_post_json('/auth/personal-access-tokens/revoke', {
                    uid: drop.personal_access_token.uid,
                });

                const status = await this.http_get_json('/auth/status');
                const uids = status.personal_access_tokens.map(t => t.uid);
                assert.ok(uids.includes(keep.personal_access_token.uid));
                assert.ok(!uids.includes(drop.personal_access_token.uid), 'revoked token should not appear in /auth/status');
            });
        });

        describe('cannot manage the authwall account', function () {

            it('cannot create another PAT using a bearer token', async function () {
                await this.sign_in({username: 'mocha', password: 'pass123'});
                const created = await this.http_post_json('/auth/personal-access-tokens', {
                    label: 'Desktop app',
                });
                const before = await db('personal_access_tokens').count('* as c').first();

                const r = await axios.post('/auth/personal-access-tokens', {label: 'evil'}, {
                    baseURL: config.public_url,
                    headers: {
                        authorization: `Bearer ${created.token}`,
                        'content-type': 'application/json',
                    },
                    timeout: 2000,
                    maxRedirects: 0,
                    validateStatus: v => v < 500,
                });

                assert.ok(r.status >= 300 && r.status < 400, `expected redirect, got ${r.status}`);
                const after = await db('personal_access_tokens').count('* as c').first();
                assert.strictEqual(Number(after.c), Number(before.c));
            });

            it('cannot revoke a PAT using a bearer token', async function () {
                await this.sign_in({username: 'mocha', password: 'pass123'});
                const created = await this.http_post_json('/auth/personal-access-tokens', {
                    label: 'Desktop app',
                });

                const r = await axios.post('/auth/personal-access-tokens/revoke', {uid: created.personal_access_token.uid}, {
                    baseURL: config.public_url,
                    headers: {
                        authorization: `Bearer ${created.token}`,
                        'content-type': 'application/json',
                    },
                    timeout: 2000,
                    maxRedirects: 0,
                    validateStatus: v => v < 500,
                });

                assert.ok(r.status >= 300 && r.status < 400, `expected redirect, got ${r.status}`);
                const row = await db('personal_access_tokens').where({uid: created.personal_access_token.uid}).first();
                assert.strictEqual(row.revoked_at, null);
            });

            it('cannot revoke a browser session using a bearer token', async function () {
                const {user_id} = await this.sign_in({username: 'mocha', password: 'pass123'});
                const created = await this.http_post_json('/auth/personal-access-tokens', {
                    label: 'Desktop app',
                });
                const session_before = await db('sessions').where({user_id}).first();

                const r = await axios.post('/auth/sessions/revoke', {uid: session_before.uid}, {
                    baseURL: config.public_url,
                    headers: {
                        authorization: `Bearer ${created.token}`,
                        'content-type': 'application/json',
                    },
                    timeout: 2000,
                    maxRedirects: 0,
                    validateStatus: v => v < 500,
                });

                assert.ok(r.status >= 300 && r.status < 400, `expected redirect, got ${r.status}`);
                const session_after = await db('sessions').where({uid: session_before.uid}).first();
                assert.ok(session_after, 'session should still exist');
            });
        });

        describe('bearer-auth rate limiting', function () {

            beforeEach(function () {
                process.env.AUTHWALL_RATE_LIMITING = '1';
            });

            afterEach(function () {
                process.env.AUTHWALL_RATE_LIMITING = '0';
            });

            it('returns 429 with Retry-After after 20 invalid bearer attempts from the same IP', async function () {
                const bad_headers = {authorization: 'Bearer awp_definitely_not_a_real_token_value_for_testing_xyz'};
                const opts = {
                    baseURL: config.public_url,
                    headers: bad_headers,
                    timeout: 2000,
                    validateStatus: v => v < 500,
                };

                for (let i = 0; i < 20; i++) {
                    const r = await axios.get('/auth/status', opts);
                    assert.strictEqual(r.status, 401, `attempt ${i + 1} should still be 401`);
                }

                const blocked = await axios.get('/auth/status', opts);
                assert.strictEqual(blocked.status, 429);
                assert.strictEqual(blocked.data, 'Too many failed authentication attempts, please try again later');
                const retry_after = Number(blocked.headers['retry-after']);
                assert.ok(retry_after > 0 && retry_after <= 15 * 60, `Retry-After should be 1..900, got ${blocked.headers['retry-after']}`);
            });
        });

        describe('email verification enforcement', function () {

            it('rejects bearer requests when the owner has no verified email', async function () {
                await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: true});
                const created = await this.http_post_json('/auth/personal-access-tokens', {
                    label: 'Desktop app',
                });

                config.confirm_email.required = true;
                await db('user_identities').where({value_normalized: 'mocha@authwall.test'}).update({verified_at: null});

                const r = await axios.get('/private', {
                    baseURL: config.public_url,
                    headers: {
                        authorization: `Bearer ${created.token}`,
                    },
                    timeout: 2000,
                    validateStatus: v => v < 500,
                });

                assert.strictEqual(r.status, 403);
                assert.strictEqual(r.data, 'Email verification required');
            });

            it('rejects bearer requests for username-only users when verification is required', async function () {
                await this.sign_in({username: 'mocha', password: 'pass123'});
                const created = await this.http_post_json('/auth/personal-access-tokens', {
                    label: 'CLI',
                });

                config.confirm_email.required = true;

                const r = await axios.get('/private', {
                    baseURL: config.public_url,
                    headers: {
                        authorization: `Bearer ${created.token}`,
                    },
                    timeout: 2000,
                    validateStatus: v => v < 500,
                });

                assert.strictEqual(r.status, 403);
                assert.strictEqual(r.data, 'Email verification required');
            });

            it('allows bearer requests when the owner has at least one verified email', async function () {
                const {user_id} = await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: true});
                const user = await db('users').where({id: user_id}).first();
                const created = await this.http_post_json('/auth/personal-access-tokens', {
                    label: 'Desktop app',
                });

                config.confirm_email.required = true;

                const r = await axios.get('/private', {
                    baseURL: config.public_url,
                    headers: {
                        authorization: `Bearer ${created.token}`,
                    },
                    timeout: 2000,
                });

                assert.partialDeepStrictEqual(r.data, {
                    echo_server: 'authwall_testing_echo_server',
                    headers: {
                        'x-auth-user': user.uid,
                    },
                });
            });
        });
    });
});
