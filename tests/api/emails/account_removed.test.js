const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');
const db = require('../../../db');

describe('emails • account_removed', function () {

    it('should be sent to the verified address after the account is removed (AW-40)', async function () {
        await this.sign_in({username: 'mocha', email: 'mocha@authwall.test', password: 'pass123'});
        this.sent_emails.splice(0);

        await this.mark_confirmed({reason: 'account_remove'});
        await this.http_post_json('/auth/account/remove', {confirmation: 'DELETE'});
        await this.wait_for_emails(1);

        assert.strictEqual((await db('users')).length, 0);
        assert.deepStrictEqual(this.sent_emails.map(v => [v.name, v.to]), [[const_email.account_removed, 'mocha@authwall.test']]);
    });

});
