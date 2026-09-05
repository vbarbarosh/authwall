const assert = require('assert');
const config = require('../../../config');
const const_auth_event = require('../../../src/helpers/const/const_auth_event');
const const_auth_event_status = require('../../../src/helpers/const/const_auth_event_status');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');

// Under email access rules a verified address is what authorizes a username
// sign-in, so removing the last one strands the account exactly as removing
// it under AUTHWALL_CONFIRM_EMAIL_REQUIRED does — and password reset, which
// needs a verified email identity, cannot bring it back.
describe('User removes their last email under access rules | stories', function () {

    beforeEach(function () {
        config.access.allowed_domains = ['authwall.test'];
        config.confirm_email.required = false;
    });

    it('refuses the removal and leaves the account able to sign in', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/email/remove', {});

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);
        assert.strictEqual(status.error, 'Cannot remove email: a verified email is required to sign in');
        assert.strictEqual(status.providers.filter(v => v.type === const_user_identity.email).length, 1);
        assert.partialDeepStrictEqual(await db('auth_events').where({event_type: const_auth_event.identity_removed}), [{
            event_status: const_auth_event_status.failure,
            custom: JSON.stringify({reason: 'last_verified_email'}),
        }]);

        // The point of the guard: username sign-in still works afterwards.
        await this.http_post_json('/auth/sign-out', {});
        await this.http_post_json('/auth/sign-in', {username: 'mocha', password: 'pass123'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null});
    });

    it('still allows removing an unverified address', async function () {
        // The guard covers only what a username sign-in relies on. An
        // unverified address authorizes nothing, so removing and re-adding it
        // stays the way to fix a typo.
        const {user_id} = await this.add_user({username: 'mocha', email: 'typo@authwall.test', verified: false, password: 'pass123'});
        await this.http_post_json('/auth/sign-in', {username: 'typo@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/email/remove', {});

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null});
        assert.strictEqual((await db('user_identities').where({user_id, type: const_user_identity.email})).length, 0);
    });

});
