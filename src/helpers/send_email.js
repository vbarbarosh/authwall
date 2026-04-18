const als = require('./als');
const format_email_address = require('./format/format_email_address');
const get_user_email_and_name = require('./models/get_user_email_and_name');
const parse_email_file = require('./parse_email_file');
const config = require('../../config');

// ⚠️ Do not send emails to non-verified email addresses.
async function send_email(params)
{
    if (!config.mailer.enabled) {
        throw new Error('Email delivery is disabled');
    }

    const {name, to, user_id, user, placeholders} = params;

    const email_and_name = to ?? await get_user_email_and_name(user_id ?? user.id);
    if (!email_and_name) {
        throw new Error(`User user_id=${user_id ?? user.id} has no associated email`);
    }

    const {subject, body} = await parse_email_file(config.emails[name], placeholders);
    const request = {
        to: format_email_address(email_and_name),
        subject,
        text: body,
        name,
        placeholders,
    };

    als.logger.write(`[send_email_request] ${JSON.stringify({name, to: request.to, subject})}`);

    const response = await als.mailer.send(request);

    als.logger.write(`[send_email_response] ${JSON.stringify(response)}`);
}

module.exports = send_email;
