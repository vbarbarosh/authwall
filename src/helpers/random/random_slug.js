const crypto = require('crypto');

const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
const base = alphabet.length;
const max = Math.floor(256 / base) * base;

function random_slug(len = 16)
{
    let out = '';
    while (out.length < len) {
        const buf = crypto.randomBytes(len);
        for (let i = 0, ii = buf.length; i < ii; ++i) {
            const byte = buf[i];
            if (byte < max) {
                out += alphabet[byte % base];
                if (out.length === len) {
                    return out;
                }
            }
        }
    }
    return out;
}

module.exports = random_slug;
