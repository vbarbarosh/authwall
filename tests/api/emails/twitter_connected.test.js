const const_email = require('../../../src/helpers/const/const_email');
const mock_twitter = require('../../mock_twitter');
const {assert_oauth_connected_email, configure_oauth_provider} = require('./_oauth_email_test_helpers');

describe('emails • twitter_connected', function () {

    beforeEach(function () {
        configure_oauth_provider('twitter');
    });

    it('should be sent after connecting an X account from profile', async function () {
        await assert_oauth_connected_email(this, {
            provider: 'twitter',
            mock: mock_twitter,
            expected: const_email.twitter_connected,
        });
    });

});
