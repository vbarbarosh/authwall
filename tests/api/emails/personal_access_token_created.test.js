const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');

describe('emails • personal_access_token_created', function () {

    beforeEach(function () {
        config.personal_access_tokens.enabled = true;
    });

    it('should be sent to the owner after creating a token (AW-92)', async function () {
        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});
        this.sent_emails.splice(0);

        await this.mark_confirmed({reason: 'pat_create'});
        await this.http_post_json('/auth/personal-access-tokens', {label: 'ci laptop'});
        await this.wait_for_emails(1);

        assert.deepStrictEqual(this.sent_emails.map(v => [v.name, v.to]), [[const_email.personal_access_token_created, 'mocha@authwall.test']]);
        assert.strictEqual(this.sent_emails[0].placeholders.label, 'ci laptop');
        assert.strictEqual(this.sent_emails[0].placeholders.tokens_link, config.public_url + config.pages.personal_access_tokens);
    });

});
