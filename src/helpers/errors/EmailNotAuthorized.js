const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');

class EmailNotAuthorized extends UserFriendlyError
{
}

module.exports = EmailNotAuthorized;
