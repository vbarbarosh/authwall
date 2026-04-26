const const_email = require('../../../src/helpers/const/const_email');
const {assert_oauth_disconnected_email, configure_oauth_provider} = require('./_oauth_email_test_helpers');

describe('emails • twitter_disconnected', function () {

    beforeEach(function () {
        configure_oauth_provider('twitter');
    });

    it('should be sent after disconnecting an X account', async function () {
        await assert_oauth_disconnected_email(this, {
            provider: 'twitter',
            provider_user_id: '123456789',
            expected: const_email.twitter_disconnected,
        });
    });

});
