const const_email = require('../../../src/helpers/const/const_email');
const mock_microsoft = require('../../mock_microsoft');
const {assert_oauth_connected_email, configure_oauth_provider} = require('./_oauth_email_test_helpers');

describe('emails • microsoft_connected', function () {

    beforeEach(function () {
        configure_oauth_provider('microsoft');
    });

    it('should be sent after connecting a Microsoft account from profile', async function () {
        await assert_oauth_connected_email(this, {
            provider: 'microsoft',
            mock: mock_microsoft,
            expected: const_email.microsoft_connected,
        });
    });

});
