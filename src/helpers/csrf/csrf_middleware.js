const config = require('../../config');
const crypto = require('crypto');

function csrf_middleware(req, res, next)
{
    const token = req.body._csrf || req.headers['x-csrf-token'];
    const cookie = String(req.headers.cookie).match(/(?:^|; )csrf_token=([^;]*)/)?.[1] ?? '';
    if (token && token === cookie && verify(token, req.sessionID)) {
        next();
    }
    else {
        next(new Error('[403] Invalid CSRF Token'));
    }
}

function verify(token, sid)
{
    try {
        if (typeof token !== 'string') {
            return false;
        }
        const parts = token.split('.');
        if (parts.length !== 2) {
            return false;
        }
        const [a, b] = parts;
        const hmac = Buffer.from(a, 'base64url');
        const salt = Buffer.from(b, 'base64url');
        if (salt.length !== 24) {
            return false;
        }
        const expected = crypto.createHmac('sha256', config.secrets.csrf_token).update(sid).update(salt).digest();
        if (hmac.length !== expected.length) {
            return false;
        }
        return crypto.timingSafeEqual(hmac, expected);
    }
    catch (error) {
        return false;
    }
}

module.exports = csrf_middleware;
