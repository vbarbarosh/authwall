const assert = require('assert');
const db = require('../../../db');
const config = require('../../../config');

describe('session', function () {

    it('sign-in replaces existing session', async function () {
        await this.add_user({username: 'mocha', password: 'pass123'});

        const status = await this.http_get_json('/auth/status');
        const session1 =  await this.client.get_session();
        await this.http_post_json('/auth/sign-in', {
            _csrf: status.csrf_token,
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

        await db('sessions').where('uid', session1.uid).update({expires_at: new Date()});

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
        assert.strictEqual(status1.authenticated, true);

        await db('sessions').where('uid', session1.uid).update({expires_at: new Date()});

        const status2 = await this.http_get_json('/auth/status');
        assert.strictEqual(status2.authenticated, false);
    });

    it('password change from profile keeps current session and revokes others', async function () {
        config.flows.password.min_password_length = 4;
        const {user_id} = await this.add_user({username: 'mocha', password: 'pass123'});

        const status = [null, null, null];
        const cookies = [new Map(), new Map(), new Map()];

        this.client.cookies = cookies[0];
        status[0] = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: status[0].csrf_token});
        status[0] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[0].authenticated, true);
        assert.strictEqual(status[0].sessions.length, 1);

        this.client.cookies = cookies[1];
        status[1] = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: status[1].csrf_token});
        status[1] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[1].authenticated, true);
        assert.strictEqual(status[1].sessions.length, 2);

        this.client.cookies = cookies[2];
        status[2] = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: status[2].csrf_token});
        status[2] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[2].authenticated, true);
        assert.strictEqual(status[2].sessions.length, 3);

        // reset password using Profile page
        this.client.cookies = cookies[0];
        await this.http_post_json('/auth/change-password', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass456', _csrf: status[0].csrf_token});
        status[0] = await this.http_get_json('/auth/status');
        assert.partialDeepStrictEqual(status[0], {
            error: null,
            authenticated: true,
        });
        assert.strictEqual(status[0].sessions.length, 1);

        // ensure other sessions are dead

        this.client.cookies = cookies[1];
        status[1] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[1].authenticated, false);

        this.client.cookies = cookies[2];
        status[2] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[2].authenticated, false);

        // ensure old sessions no longer in db
        assert.deepStrictEqual(await db('sessions').where('user_id', user_id).count('* AS c'), [{c: 1}]);
    });

    it('password reset via link revokes all sessions', async function () {
        config.flows.password.min_password_length = 4;
        const {user_id} = await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});

        const status = [null, null, null];
        const cookies = [new Map(), new Map(),new Map()];

        this.client.cookies = cookies[0];
        status[0] = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass123', _csrf: status[0].csrf_token});
        status[0] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[0].authenticated, true);
        assert.strictEqual(status[0].sessions.length, 1);

        this.client.cookies = cookies[1];
        status[1] = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass123', _csrf: status[1].csrf_token});
        status[1] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[1].authenticated, true);
        assert.strictEqual(status[1].sessions.length, 2);

        this.client.cookies = cookies[2];
        status[2] = await this.http_get_json('/auth/status');
        await this.http_post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass123', _csrf: status[2].csrf_token});
        status[2] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[2].authenticated, true);
        assert.strictEqual(status[2].sessions.length, 3);

        // request reset
        await this.http_post_json('/auth/password-reset/request', {email: 'mocha@authwall.test', _csrf: status[2].csrf_token});

        // confirm reset using token from email
        await this.http_post_json('/auth/password-reset/confirm', {
            _csrf: status[2].csrf_token,
            token: this.sent_emails.at(-1).placeholders.token,
            password: 'pass456',
            password_confirm: 'pass456',
        });
        status[2] = await this.http_get_json('/auth/status');
        assert.strictEqual(status[2].authenticated, false);

        await this.http_post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass456', _csrf: status[2].csrf_token});
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
