const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const db = require('../../../db');

// See a_magic_sign_up_is_all_or_nothing.md.
describe('A magic sign-up is all or nothing | stories', function () {

    // The database refuses every new address, after the user row is written.
    async function refuse_addresses() {
        if (config.knexvars.custom.name === 'sqlite') {
            await db.raw('CREATE TRIGGER aw112_refuse BEFORE INSERT ON user_identities BEGIN SELECT RAISE(ABORT, \'AW-112: refused\'); END');
            return;
        }
        await db.raw('CREATE FUNCTION aw112_refuse() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION \'AW-112: refused\'; END $$ LANGUAGE plpgsql');
        await db.raw('CREATE TRIGGER aw112_refuse BEFORE INSERT ON user_identities FOR EACH ROW EXECUTE FUNCTION aw112_refuse()');
    }

    async function accept_addresses() {
        if (config.knexvars.custom.name === 'sqlite') {
            await db.raw('DROP TRIGGER aw112_refuse');
            return;
        }
        await db.raw('DROP TRIGGER aw112_refuse ON user_identities');
        await db.raw('DROP FUNCTION aw112_refuse()');
    }

    function use_link(ctx, {token}) {
        return ctx.http_post_json(`${config.pages.magic_link_confirm}/open`, {token});
    }

    function use_code(ctx, {code}) {
        return ctx.http_post_json('/auth/magic-link/confirm', {email: 'bea@authwall.test', code});
    }

    for (const [way, use] of [['link', use_link], ['code', use_code]]) {
        it(`leaves no user and the same ${way} usable when the sign-up fails halfway (AW-112)`, async function () {
            // A trigger is created inside the test's transaction; MySQL would commit it.
            if (config.knexvars.custom.name === 'mysql') {
                this.skip();
            }
            await this.http_post_json('/auth/magic-link/request', {email: 'bea@authwall.test'});
            const placeholders = this.sent_emails.find(v => v.name === const_email.magic_link).placeholders;

            await refuse_addresses();
            await use(this, placeholders);
            await accept_addresses();
            assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, false);
            assert.deepStrictEqual(await db('users').count({n: '*'}).first().then(v => Number(v.n)), 0);
            assert.strictEqual((await db('magic_links').first()).used_at, null);

            await use(this, placeholders);
            assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null});
            assert.deepStrictEqual(await db('user_identities').pluck('value_normalized'), ['bea@authwall.test']);
        });
    }

});
