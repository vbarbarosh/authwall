const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');

describe('emails • google_disconnected', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    afterEach(function () {
        config.flows.google.enabled = false;
    });

    it('should be sent after disconnecting a Google account', async function () {

        const {user_id} = await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});

        const now = new Date();
        await db('user_identities').insert({
            uid: random_uid_user_identity(),
            user_id,
            type: const_user_identity.oauth_google,
            value: 'google-user-123',
            value_normalized: 'google-user-123',
            created_at: now,
            updated_at: now,
            verified_at: now,
        });

        const status = await this.client.get_json('/auth/status');
        await this.client.post_json('/auth/google/disconnect', {_csrf: status.csrf_token});
        await this.wait_for_emails(2);

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.new_sign_in, const_email.google_disconnected];
        assert.deepStrictEqual(actual, expected);
    });

});
