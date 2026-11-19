const assert = require('assert');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const db = require('../../../db');

// See a_borrowed_session_tries_passwords.md.
describe('A borrowed session tries passwords | stories', function () {

    async function change_password(ctx, current_password) {
        await ctx.http_post_json('/auth/change-password', {current_password, password: 'mallorys-pass', password_confirm: 'mallorys-pass'});
        return (await ctx.http_get_json('/auth/status')).error;
    }

    async function change_password_in_profile(ctx, current_password) {
        await ctx.http_post_json('/auth/profile', {current_password, password: 'mallorys-pass', password_confirm: 'mallorys-pass'});
        return (await ctx.http_get_json('/auth/status')).error;
    }

    async function confirm(ctx, password) {
        await ctx.http_post_json('/auth/confirm', {password});
        return (await ctx.http_get_json('/auth/status')).error;
    }

    for (const [door, attempt] of [['the password change form', change_password], ['the profile form', change_password_in_profile]]) {
        it(`refuses even Ann's password at ${door} after five wrong ones`, async function () {
            await this.sign_in({username: 'ann', email: 'ann@authwall.test', password: 'anns-pass-123'});
            for (const guess of ['123456', 'password', 'ann2026', 'qwerty', 'letmein']) {
                assert.strictEqual(await attempt(this, guess), 'Current password is incorrect');
            }
            assert.strictEqual(await attempt(this, 'anns-pass-123'), 'Too many attempts. Try again later.');
            await this.assert_password({username: 'ann', password: 'anns-pass-123'});
        });
    }

    it('keeps one budget across both forms and "confirm it is you"', async function () {
        await this.sign_in({username: 'ann', email: 'ann@authwall.test', password: 'anns-pass-123'});
        assert.strictEqual(await change_password(this, '123456'), 'Current password is incorrect');
        assert.strictEqual(await change_password_in_profile(this, 'password'), 'Current password is incorrect');
        assert.strictEqual(await confirm(this, 'ann2026'), 'Password is incorrect');
        assert.strictEqual(await change_password(this, 'qwerty'), 'Current password is incorrect');
        assert.strictEqual(await confirm(this, 'letmein'), 'Password is incorrect');

        assert.strictEqual(await confirm(this, 'anns-pass-123'), 'Too many attempts. Try again later.');
        assert.strictEqual(await change_password(this, 'anns-pass-123'), 'Too many attempts. Try again later.');
    });

    it('lets Ann change her password once the 15 minutes pass', async function () {
        const {user_id} = await this.sign_in({username: 'ann', email: 'ann@authwall.test', password: 'anns-pass-123'});
        for (const guess of ['123456', 'password', 'ann2026', 'qwerty', 'letmein']) {
            await change_password(this, guess);
        }
        assert.strictEqual(await change_password(this, 'anns-pass-123'), 'Too many attempts. Try again later.');

        await db('auth_events').where({user_id, event_type: const_auth_event.identity_confirmed}).update({created_at: new Date(Date.now() - 16*60*1000)});
        assert.strictEqual(await change_password(this, 'anns-pass-123'), null);
        await this.assert_password({username: 'ann', password: 'mallorys-pass'});
    });

});
