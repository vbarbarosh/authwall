const assert = require('assert');
const config = require('../../../config');
const db = require('../../../db');
const random_base62 = require('../../../src/helpers/random/random_base62');

// See a_password_change_is_all_or_nothing.md.
describe('A password change is all or nothing | stories', function () {

    beforeEach(function () {
        config.personal_access_tokens.enabled = true;
    });

    // Ann on her phone, her lost laptop still signed in, and a token.
    async function ann_with_a_laptop_and_a_token(ctx) {
        const {user_id} = await ctx.sign_in({username: 'ann', password: 'anns-pass-123'});
        const {id, ...phone} = await db('sessions').where({user_id}).first();
        await db('sessions').insert({...phone, uid: `awsess_${random_base62(24).toLowerCase()}`});
        await ctx.mark_confirmed({reason: 'pat_create'});
        await ctx.http_post_json('/auth/personal-access-tokens', {label: 'script'});
        return user_id;
    }

    async function credentials(user_id) {
        const sessions = await db('sessions').where({user_id}).count({n: '*'}).first().then(v => Number(v.n));
        const live_tokens = await db('personal_access_tokens').where({user_id}).whereNull('revoked_at').count({n: '*'}).first().then(v => Number(v.n));
        return {sessions, live_tokens};
    }

    for (const [form, url] of [['the password form', '/auth/change-password'], ['the profile form', '/auth/profile']]) {
        it(`keeps the old password and every credential when ${form} fails halfway (AW-110)`, async function () {
            // A schema change commits on its own on MySQL, ending the test's transaction.
            if (config.knexvars.custom.name === 'mysql') {
                this.skip();
            }
            const user_id = await ann_with_a_laptop_and_a_token(this);
            assert.deepStrictEqual(await credentials(user_id), {sessions: 2, live_tokens: 1});

            // Revoking the tokens fails, after the new password is written.
            await db.raw('ALTER TABLE personal_access_tokens RENAME TO personal_access_tokens_away');
            await this.http_post_json(url, {current_password: 'anns-pass-123', password: 'new-pass-456', password_confirm: 'new-pass-456'});
            await db.raw('ALTER TABLE personal_access_tokens_away RENAME TO personal_access_tokens');

            await this.assert_password({username: 'ann', password: 'anns-pass-123'});
            assert.deepStrictEqual(await credentials(user_id), {sessions: 2, live_tokens: 1});

            // When the database works, everything goes together.
            await this.http_post_json(url, {current_password: 'anns-pass-123', password: 'new-pass-456', password_confirm: 'new-pass-456'});
            await this.assert_password({username: 'ann', password: 'new-pass-456'});
            assert.deepStrictEqual(await credentials(user_id), {sessions: 1, live_tokens: 0});
        });
    }

});
