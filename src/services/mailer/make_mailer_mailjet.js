const config = require('../../../config');
const http_post_json = require('../../http/http_post_json');
const ignore = require('@vbarbarosh/node-helpers/src/ignore');

function make_mailer_mailjet()
{
    return {
        send: async function ({to, subject, text}) {
            const from = parse_mailjet_email_address(config.mailjet_from);
            const recipient = parse_mailjet_email_address(to);
            const params = {
                auth: {
                    username: config.mailjet_key,
                    password: config.mailjet_secret,
                },
            };
            const data = {
                Messages: [
                    {
                        From: from,
                        To: [recipient],
                        Subject: subject,
                        TextPart: text,
                    },
                ],
            };
            const out = await http_post_json('https://api.mailjet.com/v3.1/send', data, params).catch(throw_mailjet_error);
            const message = out?.Messages?.[0];
            if (!message) {
                throw new Error(`Email delivery failed: Invalid Mailjet response\n\n${JSON.stringify(out)}`);
            }
            if (String(message.Status).toLowerCase() !== 'success') {
                const details = Array.from(message.Errors ?? []).map(v => v.ErrorMessage || v.ErrorCode || JSON.stringify(v)).join('; ');
                throw new Error(`Email delivery failed: ${details || 'Unknown Mailjet failure'}\n\n${JSON.stringify(out)}`);
            }
            return out;
        },
        [Symbol.dispose]: ignore,
    };
}

function parse_mailjet_email_address(input)
{
    if (typeof input !== 'string' || !input.trim()) {
        throw new Error('Missing email input');
    }

    const value = input.trim();
    const match = value.match(/^(.*)<([^<>]+)>$/);
    if (!match) {
        return {Email: value};
    }

    let name = match[1].trim();
    if (name.startsWith('"') && name.endsWith('"')) {
        name = name.slice(1, -1).replace(/\\"/g, '"');
    }

    const out = {
        Email: match[2].trim(),
    };

    if (name) {
        out.Name = name;
    }

    return out;
}

function throw_mailjet_error(error)
{
    const response = error.response?.data;
    const details = Array.isArray(response?.ErrorInfo)
        ? response.ErrorInfo.join('; ')
        : response?.ErrorMessage;
    const message = details || error.message;
    throw new Error(`Email delivery failed: ${message}\n\n${JSON.stringify(response ?? {message: error.message})}`, {cause: error});
}

module.exports = make_mailer_mailjet;
