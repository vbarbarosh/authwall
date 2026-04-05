const NotImplemented = require('@vbarbarosh/node-helpers/src/errors/NotImplemented');
const ignore = require('@vbarbarosh/node-helpers/src/ignore');

function make_mailer_ses()
{
    return {
        send: async function ({to, subject, text}) {
            throw new NotImplemented();
        },
        [Symbol.dispose]: ignore,
    };
}

module.exports = make_mailer_ses;
