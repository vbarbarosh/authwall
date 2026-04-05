const als = require('./als');
const send_email = require('./send_email');

async function send_email_nothrow(params)
{
    try {
        await send_email(params);
    }
    catch (error) {
        als.logger.write(`[send_email_nothrow_error] ${error.message}`);
    }
}

module.exports = send_email_nothrow;
