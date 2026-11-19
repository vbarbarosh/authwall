const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const bcrypt = require('bcrypt');
const const_auth_event = require('../const/const_auth_event');
const const_auth_event_status = require('../const/const_auth_event_status');
const insert_auth_event = require('../insert_auth_event');

// Throws unless password is the account's current password. A wrong one is
// recorded as a failed confirmation, so the confirmation budget counts it
// (M-07).
async function assert_password_valid(req, user, password)
{
    if (!await bcrypt.compare(password, user.password_hash)) {
        await insert_auth_event({req, event_type: const_auth_event.identity_confirmed, event_status: const_auth_event_status.failure, custom: {method: 'current_password'}});
        throw new UserFriendlyError('Current password is incorrect');
    }
}

module.exports = assert_password_valid;
