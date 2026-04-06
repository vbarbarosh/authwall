const als = require('./als');
const format_email_address = require('./format/format_email_address');
const get_user_email_and_name = require('./models/get_user_email_and_name');
const parse_email_file = require('./parse_email_file');

// ⚠️ Do not send emails to non-verified email addresses.
async function send_email(params)
{
    const {to, user_id, user, path, placeholders} = params;

    const email_and_name = to ?? await get_user_email_and_name(user_id ?? user.id);
    if (!email_and_name) {
        throw new Error(`User user_id=${user_id ?? user.id} has no associated email`);
    }

    const {subject, body} = await parse_email_file(path, placeholders);
    const request = {
        to: format_email_address(email_and_name),
        subject,
        text: body,
    };

    als.logger.write(`[send_email_request] ${JSON.stringify(request)}`);

    const response = await als.mailer.send(request);

    als.logger.write(`[send_email_response] ${JSON.stringify(response)}`);
}

module.exports = send_email;
