const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • magic_link_without_code', function () {

    it('should be sent after requesting magic link in link mode', async function () {
        config.flows.magic_link.mode = 'link';

        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.magic_link_without_code];
        assert.deepStrictEqual(actual, expected);
    });

});
