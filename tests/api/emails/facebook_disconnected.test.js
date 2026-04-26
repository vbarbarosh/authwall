const const_email = require('../../../src/helpers/const/const_email');
const {assert_oauth_disconnected_email, configure_oauth_provider} = require('./_oauth_email_test_helpers');

describe('emails • facebook_disconnected', function () {

    beforeEach(function () {
        configure_oauth_provider('facebook');
    });

    it('should be sent after disconnecting a Facebook account', async function () {
        await assert_oauth_disconnected_email(this, {
            provider: 'facebook',
            provider_user_id: 'facebook-user-123',
            expected: const_email.facebook_disconnected,
        });
    });

});
