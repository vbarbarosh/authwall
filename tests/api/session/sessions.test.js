const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const date_trunc_ms = require('../../../src/helpers/date/date_trunc_ms');
const db = require('../../../db');
const normalize_email = require('../../../src/helpers/normalize/normalize_email');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');

describe('session', function () {

    it('sign-in replaces existing session', async function () {
        await this.add_user({username: 'mocha', password: 'pass123'});

        await this.http_get_json('/auth/status');
        const session1 =  await this.client.get_session();

        await this.http_post_json('/auth/sign-in', {
            username: 'mocha',
            password: 'pass123',
        });
        const session2 = await this.client.get_session();

        assert.notStrictEqual(session1.uid, session2.uid);
        assert.ok(await db('sessions').where('uid', session1.uid).first() === undefined);
        assert.ok(await db('sessions').where('uid', session2.uid).first() !== undefined);
    });

    it('expired session is ignored', async function () {
        await this.http_get_json('/auth/status');
        const session1 = await this.client.get_session();

        await db('sessions').where('uid', session1.uid).update({expires_at: date_trunc_ms()});

        await this.http_get_json('/auth/status');
        const session2 = await this.client.get_session();

        assert.notStrictEqual(session1.uid, session2.uid);
        assert.ok(await db('sessions').where('uid', session1.uid).first() !== undefined);
        assert.ok(await db('sessions').where('uid', session2.uid).first() !== undefined);
    });

    it('expired session results in unauthenticated user', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});

        const status1 = await this.http_get_json('/auth/status');
        const session1 = await this.client.get_session();
        assert.strictEqual(status1.authenticated, true, 'Fresh authentication');

        await db('sessions').where('uid', session1.uid).update({expires_at: date_trunc_ms()});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.authenticated, false, 'Expiration time');
    });

    it('expired session should get new UID', async function () {
        await this.http_get_json('/auth/status');
        const session1 = await this.client.get_session();

        await db('sessions').where('uid', session1.uid).update({expires_at: date_trunc_ms()});

        await this.http_get_json('/auth/status');
        const session2 = await this.client.get_session();

        assert.notStrictEqual(session1.uid, session2.uid);
    });

    it('does not store email verification fields when enforcement is disabled', async function () {
        config.email_verification.required = false;

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: true});
        const session = await this.client.get_session();

        assert.strictEqual('email' in session, false);
        assert.strictEqual('email_verified_at' in session, false);
    });

    it('stores unverified email in session when enforcement is enabled', async function () {
        config.email_verification.required = true;

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: false});
        const session = await this.client.get_session();

        assert.strictEqual(session.email, 'mocha@authwall.test');
        assert.strictEqual(session.email_verified_at, null);
    });

    it('stores verified email timestamp in session when enforcement is enabled', async function () {
        config.email_verification.required = true;

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123', verified: true});
        const session = await this.client.get_session();

        assert.strictEqual(session.email, 'mocha@authwall.test');
        assert.match(session.email_verified_at, /^\d{4}-\d{2}-\d{2}T/);
    });

    it('stores null email fields for username-only sessions when enforcement is enabled', async function () {
        config.email_verification.required = true;

        await this.sign_in({username: 'mocha', password: 'pass123'});
        const session = await this.client.get_session();

        assert.strictEqual(session.email, null);
        assert.strictEqual(session.email_verified_at, null);
    });

    it('prefers verified email identity for enforced session fields', async function () {
        config.email_verification.required = true;

        const {user_id} = await this.add_user({email: 'unverified@authwall.test', password: 'pass123', verified: false});
        const now = new Date();
        await db('user_identities').insert({
            uid: random_uid_user_identity(),
            user_id,
            type: const_user_identity.email,
            value: 'verified@authwall.test',
            value_normalized: normalize_email('verified@authwall.test'),
            created_at: now,
            updated_at: now,
            verified_at: now,
        });

        await this.http_post_json('/auth/sign-in', {username: 'unverified@authwall.test', password: 'pass123'});
        const session = await this.client.get_session();

        assert.strictEqual(session.email, 'verified@authwall.test');
        assert.match(session.email_verified_at, /^\d{4}-\d{2}-\d{2}T/);
    });

    it('password change from profile keeps current session and revokes others', async function () {
        config.flows.password.min_password_length = 4;
        const {user_id} = await this.add_user({username: 'mocha', password: 'pass123'});

        const status = [null, null, null];
        const cookies = [new Map(), new Map(), new Map()];

        this.client.cookies = cookies[0];
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});
        status[0] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[0].authenticated, true);
        assert.strictEqual(status[0].sessions.length, 1);

        this.client.cookies = cookies[1];
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});
        status[1] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[1].authenticated, true);
        assert.strictEqual(status[1].sessions.length, 2);

        this.client.cookies = cookies[2];
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});
        status[2] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[2].authenticated, true);
        assert.strictEqual(status[2].sessions.length, 3);

        // reset password using Profile page
        this.client.cookies = cookies[0];
        await this.http_post_json('/auth/change-password', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass456'});
        status[0] = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status[0], {
            error: null,
            authenticated: true,
        });
        assert.strictEqual(status[0].sessions.length, 1);

        // ensure other sessions are dead

        this.client.cookies = cookies[1];
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: false,
        });

        this.client.cookies = cookies[2];
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: false,
        });

        // ensure old sessions no longer in db
        assert.deepStrictEqual(await db('sessions').where('user_id', user_id).count('* AS c'), [{c: 1}]);
    });

    it('password reset via link revokes all sessions', async function () {
        config.flows.password.min_password_length = 4;

        const {user_id} = await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});

        const status = [null, null, null];
        const cookies = [new Map(), new Map(),new Map()];

        this.client.cookies = cookies[0];
        await this.http_post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass123'});
        status[0] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[0].authenticated, true);
        assert.strictEqual(status[0].sessions.length, 1);

        this.client.cookies = cookies[1];
        await this.http_post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass123'});
        status[1] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[1].authenticated, true);
        assert.strictEqual(status[1].sessions.length, 2);

        this.client.cookies = cookies[2];
        await this.http_post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass123'});
        status[2] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[2].authenticated, true);
        assert.strictEqual(status[2].sessions.length, 3);

        // request reset
        await this.http_post_json('/auth/password-reset/request', {email: 'mocha@authwall.test'});

        // confirm reset using token from email
        await this.http_post_json('/auth/password-reset/confirm', {
            token: this.sent_emails.at(-1).placeholders.token,
            password: 'pass456',
            password_confirm: 'pass456',
        });
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            authenticated: false,
        });

        await this.http_post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass456'});
        status[2] = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status[2], {
            error: null,
            authenticated: true,
        });
        assert.strictEqual(status[2].sessions.length, 1);

        // ensure other sessions are dead

        this.client.cookies = cookies[0];
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: false,
        });

        this.client.cookies = cookies[1];
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: false,
        });

        // ensure old sessions no longer in db
        assert.deepStrictEqual(await db('sessions').where('user_id', user_id).count('* AS c'), [{c: 1}]);
    });

});
