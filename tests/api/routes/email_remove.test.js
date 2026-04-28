const assert = require('assert');
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

});
