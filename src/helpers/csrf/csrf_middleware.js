const config = require('../../config');
const crypto = require('crypto');
const csrf_token = require('./csrf_token');

function csrf_middleware(req, res, next)
{
    const raw_cookie = String(req.headers.cookie).match(/(?:^|; )csrf_token=([^;]*)/)?.[1] ?? '';

    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        res.cookie('csrf_token', raw_cookie || csrf_token(req.sessionID), {
            path: '/auth',
            httpOnly: false,
            sameSite: 'lax',
            secure: config.public_url.startsWith('https://'),
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });
        next();
        return;
    }

    const token = req.headers['x-csrf-token'] || req.body._csrf;
    if (token && token === raw_cookie && verify(token, req.sessionID)) {
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
