const config = require('../../config');
const format_email_address = require('./format/format_email_address');
const get_user_email_and_name = require('./models/get_user_email_and_name');
const parse_email_file = require('./parse_email_file');
const resend = require('resend');

let client = null;

async function send_email(params)
{
    const {to, user_id, user, path, placeholders} = params;

    const email_and_name = to ?? await get_user_email_and_name(user_id ?? user.id);
    if (!email_and_name) {
        throw new Error(`User user_id=${user_id ?? user.id} has no associated email`);
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

    // {
    //     "data": null,
    //     "error": {
    //         "statusCode": 422,
    //         "name": "validation_error",
    //         "message": "Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format."
    //     },
    //     "headers": {
    //         "cf-cache-status": "DYNAMIC",
    //         "cf-ray": "9e3a56a85adf186a-KIV",
    //         "connection": "keep-alive",
    //         "content-length": "172",
    //         "content-type": "application/json",
    //         "date": "Sat, 28 Mar 2026 23:15:44 GMT",
    //         "ratelimit-limit": "5",
    //         "ratelimit-policy": "5;w=1",
    //         "ratelimit-remaining": "4",
    //         "ratelimit-reset": "1",
    //         "server": "cloudflare"
    //     }
    // }
    if (response.error) {
        throw new Error(response.error.message);
    }
}

module.exports = send_email;
