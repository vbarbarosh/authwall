const assert = require('assert');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • magic_link', function () {

    it('should be sent after requesting magic link', async function () {
        const email = 'mocha@authwall.test';

        const status = await this.http_get_json('/auth/status');
        await this.client.post_json('/auth/magic-link/request', {email, _csrf: status.csrf_token});

        const actual = this.sent_emails.map(v => v.name)
        const expected = [const_email.magic_link];
        assert.deepStrictEqual(actual, expected);
    });

});
