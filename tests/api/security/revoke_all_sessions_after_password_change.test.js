const assert = require('assert');

describe('revoke all sessions after password change', function () {

    it('password change from profile should revoke other sessions', async function () {
        await this.add_user({username: 'mocha', password: 'pass123'});

        const status = [null, null, null];
        const cookies = [new Map(), new Map(), new Map()];

        this.client.cookies = cookies[0];
        status[0] = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: status[0].csrf_token});
        status[0] = await this.client.get_json('/auth/status');
        assert.strictEqual(status[0].authenticated, true);
        assert.strictEqual(status[0].sessions.length, 1);

        this.client.cookies = cookies[1];
        status[1] = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: status[1].csrf_token});
        status[1] = await this.client.get_json('/auth/status');
        assert.strictEqual(status[1].authenticated, true);
        assert.strictEqual(status[1].sessions.length, 2);

        this.client.cookies = cookies[2];
        status[2] = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'mocha', password: 'pass123', _csrf: status[2].csrf_token});
        status[2] = await this.client.get_json('/auth/status');
        assert.strictEqual(status[2].authenticated, true);
        assert.strictEqual(status[2].sessions.length, 3);

        // reset password using Profile page
        this.client.cookies = cookies[0];
        await this.client.post_json('/auth/change-password', {current_password: 'pass123', password: 'pass456', password_confirm: 'pass456', _csrf: status[0].csrf_token});
        status[0] = await this.client.get_json('/auth/status');
        assert.strictEqual(status[0].authenticated, true);
        assert.strictEqual(status[0].sessions.length, 1);

        // ensure other sessions are dead

        this.client.cookies = cookies[1];
        status[1] = await this.client.get_json('/auth/status');
        assert.strictEqual(status[1].authenticated, false);

        this.client.cookies = cookies[2];
        status[2] = await this.client.get_json('/auth/status');
        assert.strictEqual(status[2].authenticated, false);
    });

    it('password change via reset link should revoke all sessions', async function () {
        await this.add_user({email: 'mocha@authwall.test', password: 'pass123'});

        const status = [null, null, null];
        const cookies = [new Map(), new Map(),new Map()];

        this.client.cookies = cookies[0];
        status[0] = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass123', _csrf: status[0].csrf_token});
        status[0] = await this.client.get_json('/auth/status');
        assert.strictEqual(status[0].authenticated, true);
        assert.strictEqual(status[0].sessions.length, 1);

        this.client.cookies = cookies[1];
        status[1] = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass123', _csrf: status[1].csrf_token});
        status[1] = await this.client.get_json('/auth/status');
        assert.strictEqual(status[1].authenticated, true);
        assert.strictEqual(status[1].sessions.length, 2);

        this.client.cookies = cookies[2];
        status[2] = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass123', _csrf: status[2].csrf_token});
        status[2] = await this.client.get_json('/auth/status');
        assert.strictEqual(status[2].authenticated, true);
        assert.strictEqual(status[2].sessions.length, 3);

        // request reset
        await this.client.post_json('/auth/password-reset/request', {email: 'mocha@authwall.test', _csrf: status[2].csrf_token});

        // confirm reset using token from email
        await this.client.post_json('/auth/password-reset/confirm', {
            token: this.sent_emails.at(-1).placeholders.token,
            password: 'pass456',
            password_confirm: 'pass456',
            _csrf: status[2].csrf_token,
        });
        status[2] = await this.client.get_json('/auth/status');
        assert.strictEqual(status[2].authenticated, false);

        await this.client.post_json('/auth/sign-in', {username: 'mocha@authwall.test', password: 'pass456', _csrf: status[2].csrf_token});
        status[2] = await this.client.get_json('/auth/status');
        assert.strictEqual(status[2].authenticated, true);
        assert.strictEqual(status[2].sessions.length, 1);

        // ensure other sessions are dead

        this.client.cookies = cookies[0];
        status[0] = await this.client.get_json('/auth/status');
        assert.strictEqual(status[0].authenticated, false);

        this.client.cookies = cookies[1];
        status[1] = await this.client.get_json('/auth/status');
        assert.strictEqual(status[1].authenticated, false);
    });

});
