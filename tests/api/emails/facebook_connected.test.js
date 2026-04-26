const const_email = require('../../../src/helpers/const/const_email');
const mock_facebook = require('../../mock_facebook');
const {assert_oauth_connected_email, configure_oauth_provider} = require('./_oauth_email_test_helpers');

describe('emails • facebook_connected', function () {

    beforeEach(function () {
        configure_oauth_provider('facebook');
    });

    it('should be sent after connecting a Facebook account from profile', async function () {
        await assert_oauth_connected_email(this, {
            provider: 'facebook',
            mock: mock_facebook,
            expected: const_email.facebook_connected,
        });
    });

});
