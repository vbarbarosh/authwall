const resend = require('resend');
const config = require('../../config');
const parse_email_file = require('./parse_email_file');

let client = null;

async function send_email(params)
{
    client ??= new resend.Resend(config.resend_key);

    const {to, path, placeholders} = params;

    const {subject, body} = await parse_email_file(path, placeholders);

    const response = await client.emails.send({
        from: config.resend_from,
        to,
        subject,
        text: body,
    });

    console.log(`[send_email] ${JSON.stringify(response)}`);
}

module.exports = send_email;
