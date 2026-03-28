const config = require('../../config');
const format_email_address = require('./format/format_email_address');
const get_user_email_and_name = require('./models/get_user_email_and_name');
const parse_email_file = require('./parse_email_file');
const resend = require('resend');

let client = null;

async function send_email(params)
{
    const {user, path, placeholders} = params;

    const email_and_name = await get_user_email_and_name(user.id);
    if (!email_and_name) {
        console.log(`User ${user.uid} has now associated email`);
        return;
    }

    client ??= new resend.Resend(config.resend_key);

    const {subject, body} = await parse_email_file(path, placeholders);

    const request = {
        from: config.resend_from,
        to: format_email_address(email_and_name),
        subject,
        text: body,
    };
    const response = await client.emails.send(request);

    console.log(`[send_email_request] ${JSON.stringify(request)}`);
    console.log(`[send_email_response] ${JSON.stringify(response)}`);
}

module.exports = send_email;
