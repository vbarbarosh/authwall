const NotImplemented = require('@vbarbarosh/node-helpers/src/errors/NotImplemented');

function make_logger_na()
{
    return {
        send: function (s) {
            throw new NotImplemented();
        },
        spawn: function () {
            throw new NotImplemented();
        },
    };
}

module.exports = make_logger_na;
