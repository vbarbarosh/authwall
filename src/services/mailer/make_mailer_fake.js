const ignore = require('@vbarbarosh/node-helpers/src/ignore');

function make_mailer_fake(sent_emails = [])
{
    return {
        send: async function (params) {
            sent_emails.push(params);
            return {id: sent_emails.length};
        },
        [Symbol.dispose]: ignore,
    };
}

module.exports = make_mailer_fake;
