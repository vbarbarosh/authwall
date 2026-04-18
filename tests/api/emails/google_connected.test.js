const assert = require('assert');
const config = require('../../../config');
const const_email = require('../../../src/helpers/const/const_email');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const mock_google = require('../../mock_google');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('emails • google_connected', function () {

    beforeEach(function () {
        config.flows.google.enabled = true;
        config.flows.google.client_id = 'mocha_google_client_id';
        config.flows.google.redirect_url = 'mocha_google_redirect_url';
    });

    it('should be sent after connecting a Google account from profile', async function () {

        mock_google();

        await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});

        await this.client.get_json_no_redirects('/auth/google?connect=1');
        const sess = await this.client.get_session();

        await this.http_get_json(urlmod('/auth/google/callback', {
            state: sess.oauth_state,
            code: '4/fake_code',
        }));
        await this.wait_for_emails(1);

        const actual = this.sent_emails.map(v => v.name);
        const expected = [const_email.google_connected];
        assert.deepStrictEqual(actual, expected);
    });

    it('should not be sent when Google is already connected', async function () {

        mock_google();

        const {user_id} = await this.sign_in({email: 'mocha@authwall.test', password: 'pass123'});

        // Pre-link google account
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

        await this.client.get_json_no_redirects('/auth/google?connect=1');
        const sess = await this.client.get_session();

        await this.http_get_json(urlmod('/auth/google/callback', {
            state: sess.oauth_state,
            code: '4/fake_code',
        }));

        const actual = this.sent_emails.map(v => v.name);
        const expected = [];
        assert.deepStrictEqual(actual, expected);
    });

});
