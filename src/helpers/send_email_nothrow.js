const send_email = require('./send_email');

async function send_email_nothrow(params)
{
    try {
        await send_email(params);
    }
    catch (error) {
        console.log('send_email failed', error);
    }
}

module.exports = send_email_nothrow;
