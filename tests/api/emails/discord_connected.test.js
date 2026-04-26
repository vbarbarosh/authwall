const const_email = require('../../../src/helpers/const/const_email');
const mock_discord = require('../../mock_discord');
const {assert_oauth_connected_email, configure_oauth_provider} = require('./_oauth_email_test_helpers');

describe('emails • discord_connected', function () {

    beforeEach(function () {
        configure_oauth_provider('discord');
    });

    it('should be sent after connecting a Discord account from profile', async function () {
        await assert_oauth_connected_email(this, {
            provider: 'discord',
            mock: mock_discord,
            expected: const_email.discord_connected,
        });
    });

});
