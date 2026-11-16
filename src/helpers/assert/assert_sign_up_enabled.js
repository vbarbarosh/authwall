const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const config = require('../../../config');

function assert_sign_up_enabled()
{
    if (!config.sign_up.enabled) {
        throw new UserFriendlyError('Registration is closed');
    }
}

module.exports = assert_sign_up_enabled;
