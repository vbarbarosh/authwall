const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • magic_link', function () {

    it('should be sent after requesting magic link', async function () {
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.magic_link];
        assert.deepStrictEqual(actual, expected);
    });

});
