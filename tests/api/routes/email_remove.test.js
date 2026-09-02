const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');

describe('POST /auth/email/remove', function () {

    it('removes the email identity when another identity remains', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/email/remove');

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, null);
        assert.ok(status.providers.find(v => v.type === const_user_identity.username));
        assert.strictEqual(status.providers.find(v => v.type === const_user_identity.email), undefined);
    });

    it('fails when email is the only identity', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});

        await this.http_post_json('/auth/email/remove');

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.error, 'Cannot remove email: it is your only sign-in method');
        assert.ok(status.providers.find(v => v.type === const_user_identity.email));
    });


    describe('with email verification required', function () {

        beforeEach(function () {
            config.confirm_email.required = true;
        });

        it('refuses to remove the only verified email', async function () {
            await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123', verified: true});

            await this.http_post_json('/auth/email/remove');

            const status = await this.http_get_json('/auth/status');
            assert.strictEqual(status.error, 'Cannot remove email: a verified email is required to sign in');
            assert.ok(status.providers.find(v => v.type === const_user_identity.email));
        });

        it('lets a held user replace a mistyped, unverified address', async function () {
            await this.sign_in({username: 'mocha', email: 'typo@authwall.test', password: 'pass123', verified: false});

            // Held: protected paths redirect to the verify page...
            const held = await this.client.get_json_no_redirects('/protected');
            assert.strictEqual(held.status, 302);
            assert.match(held.headers.location, /^\/auth\/email-verify\?/);
            assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Email verification required');

            // ...but fixing the address is still possible.
            await this.http_post_json('/auth/email/remove');
            assert.strictEqual((await this.http_get_json('/auth/status')).error, null);

            await this.http_post_json('/auth/email/add', {email: 'right@authwall.test'});
            await this.wait_for_emails(1);

            const status = await this.http_get_json('/auth/status');
            assert.strictEqual(status.error, null);
            assert.strictEqual(status.providers.find(v => v.type === const_user_identity.email).value, 'right@authwall.test');
            assert.strictEqual(this.sent_emails[0].to, 'right@authwall.test');
        });

    });

});
