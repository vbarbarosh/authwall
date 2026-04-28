const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');

describe('emails • github_disconnected', function () {

    beforeEach(function () {
        config.flows.github.enabled = true;
        config.flows.github.client_id = 'mocha_github_client_id';
        config.flows.github.redirect_url = 'mocha_github_redirect_url';
    });

    it('should be sent after disconnecting a GitHub account', async function () {

        const {user_id} = await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});

        const now = new Date();
        await db('user_identities').insert({
            uid: random_uid_user_identity(),
            user_id,
            type: const_user_identity.oauth_github,
            value: 'github-user-123',
            value_normalized: 'github-user-123',
            created_at: now,
            updated_at: now,
            verified_at: now,
        });

        await this.http_post_json('/auth/github/disconnect');
        await this.wait_for_emails(1);

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.github_disconnected];
        assert.deepStrictEqual(actual, expected);
    });

});
