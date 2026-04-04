const NotImplemented = require('@vbarbarosh/node-helpers/src/errors/NotImplemented');

function make_mailer_ses()
{
    return {
        send: async function ({to, subject, text}) {
            throw new NotImplemented();
        },
    };
}

module.exports = make_mailer_ses;
