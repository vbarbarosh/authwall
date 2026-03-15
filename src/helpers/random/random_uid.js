const cuid2 = require('@paralleldrive/cuid2');

const inst = cuid2.init();

function random_uid(prefix = '')
{
    return prefix + inst();
}

module.exports = random_uid;
