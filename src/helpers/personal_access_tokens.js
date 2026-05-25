const crypto = require('crypto');
const random_base62 = require('./random/random_base62');

const TOKEN_PREFIX_LENGTH = 16;
const TOKEN_SECRET_LENGTH = 43;

function create_personal_access_token_secret()
{
    return `awp_${random_base62(TOKEN_SECRET_LENGTH)}`;
}

function personal_access_token_hash(token)
{
    return crypto.createHash('sha256').update(token).digest('hex');
}

function personal_access_token_prefix(token)
{
    return token.slice(0, TOKEN_PREFIX_LENGTH);
}

module.exports = {
    create_personal_access_token_secret,
    personal_access_token_hash,
    personal_access_token_prefix,
};
