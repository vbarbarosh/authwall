const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • magic_link_without_link', function () {

    it('should be sent after requesting magic link in code mode', async function () {
        config.flows.magic_link.mode = 'code';

        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.magic_link_without_link];
        assert.deepStrictEqual(actual, expected);
    });

});
