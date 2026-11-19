const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const bcrypt = require('bcrypt');

// Throws unless password is the account's current password. The confirmation
// budget counts a wrong one: the caller reserves its try before (M-07, AW-87).
async function assert_password_valid(user, password)
{
    if (!await bcrypt.compare(password, user.password_hash)) {
        throw new UserFriendlyError('Current password is incorrect');
    }
}

module.exports = assert_password_valid;
