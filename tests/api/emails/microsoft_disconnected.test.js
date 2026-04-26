const const_email = require('../../../src/helpers/const/const_email');
const {assert_oauth_disconnected_email, configure_oauth_provider} = require('./_oauth_email_test_helpers');

describe('emails • microsoft_disconnected', function () {

    beforeEach(function () {
        configure_oauth_provider('microsoft');
    });

    it('should be sent after disconnecting a Microsoft account', async function () {
        await assert_oauth_disconnected_email(this, {
            provider: 'microsoft',
            provider_user_id: 'microsoft-user-123',
            expected: const_email.microsoft_disconnected,
        });
    });

});
