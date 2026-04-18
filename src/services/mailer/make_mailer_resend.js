const config = require('../../../config');
const resend = require('resend');

function make_mailer_resend()
{
    let client = new resend.Resend(config.resend_key);

    return {
        send: async function ({to, subject, text}) {
            const out = await client.emails.send({from: config.resend_from, to, subject, text});
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
            if (out.error) {
                throw new Error(`Email delivery failed: ${out.error.message}\n\n${JSON.stringify(out)}`);
            }
            return out;
        },
        [Symbol.dispose]: function () {
            client = null;
        },
    };
}

module.exports = make_mailer_resend;
