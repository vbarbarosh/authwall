const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const mock_google = require('../../mock_google');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('Disabled mailer Google sign-in flow | stories', function () {

    beforeEach(function () {
        config.mailer.enabled = false;
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.client_secret = 'mocha_google_client_secret';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    it('signs in a verified-email Google user without attempting email delivery', async function () {
        const {user_id} = await this.add_user({email: 'verified-google@authwall.test', password: null});
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

        mock_google();
        await this.client.get_json_no_redirects('/auth/google');
        const sess = await this.client.get_session();
        await this.http_get_json(urlmod('/auth/google/callback', {
            state: sess.oauth_state,
            code: '4/fake_code',
        }));

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });
        assert.deepStrictEqual(this.sent_emails, []);
        assert.strictEqual(this.written_logs.some(v => v.includes('send_email')), false);
    });

});
