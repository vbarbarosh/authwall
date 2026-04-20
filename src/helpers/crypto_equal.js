const crypto = require('crypto');

/**
 * timing-safe string comparison
 */
function crypto_equal(a, b)
{
    if (typeof a === 'string') {
        a = Buffer.from(a);
    }
    if (typeof b === 'string') {
        b = Buffer.from(b);
    }

    if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
        return false;
    }

    if (a.length !== b.length) {
        return false;
    }

    return crypto.timingSafeEqual(a, b);
}

module.exports = crypto_equal;
