const config = require('../../config');
const crypto = require('crypto');

// https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie
function csrf_token(sid)
{
    const salt = crypto.randomBytes(24);
    const hmac = crypto.createHmac('sha256', config.secrets.csrf_token)
        .update(sid).update(salt).digest();
    return hmac.toString('base64url') + '.' + salt.toString('base64url');
}

module.exports = csrf_token;
