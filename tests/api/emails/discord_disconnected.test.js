const const_email = require('../../../src/helpers/const/const_email');
const {assert_oauth_disconnected_email, configure_oauth_provider} = require('./_oauth_email_test_helpers');

describe('emails • discord_disconnected', function () {

    beforeEach(function () {
        configure_oauth_provider('discord');
    });

    it('should be sent after disconnecting a Discord account', async function () {
        await assert_oauth_disconnected_email(this, {
            provider: 'discord',
            provider_user_id: '123456789123456789',
            expected: const_email.discord_disconnected,
        });
    });

});
