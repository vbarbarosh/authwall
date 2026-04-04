function make_mailer_fake(sent_emails)
{
    return {
        send: async function (params) {
            sent_emails.push(params);
            return {id: sent_emails.length};
        },
    };
}

module.exports = make_mailer_fake;
