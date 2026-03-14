const crypto = require('crypto');

function random_code(size = 6)
{
    let out = '';
    for (let i = 0; i < size; ++i) {
        out += crypto.randomInt(0, 10);
    }
    return out;
}

module.exports = random_code;
