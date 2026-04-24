const config = require('../../../config');
const http_post_json = require('../../http/http_post_json');
const ignore = require('@vbarbarosh/node-helpers/src/ignore');
const pkg = require('../../../package.json');

// https://resend.com/docs/api-reference/emails/send-email
function make_mailer_resend()
{
    return {
        send: async function ({to, subject, text}) {
            const data = {
                from: config.mailer.resend.from,
                to,
                subject,
                text,
            };
            const params = {
                headers: {
                    Authorization: `Bearer ${config.mailer.resend.key}`,
                    'User-Agent': `vbarbarosh/authwall:${pkg.version}`,
                },
            };
            const out = await http_post_json('https://api.resend.com/emails', data, params).catch(throw_resend_error);
            if (!out?.id) {
                throw new Error(`Email delivery failed: Invalid Resend response\n\n${JSON.stringify(out)}`);
            }
            return out;
        },
        [Symbol.dispose]: ignore,
    };
}

function throw_resend_error(error)
{
    const response = error.response?.data;
    const message = response?.message || response?.error?.message || error.message;
    throw new Error(`Email delivery failed: ${message}\n\n${JSON.stringify(response ?? {message: error.message})}`);
}

module.exports = make_mailer_resend;
