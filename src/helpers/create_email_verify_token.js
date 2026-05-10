const bcrypt = require('bcrypt');
const config = require('../../config');
const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const date_add_minutes = require('@vbarbarosh/node-helpers/src/date_add_minutes');
const db = require('../../db');
const random_code = require('./random/random_code');
const random_hex = require('@vbarbarosh/node-helpers/src/random_hex');

async function create_email_verify_token(user_id, email_normalized, now = new Date())
{
    const token = random_hex();
    const code = config.confirm_email.mode === 'link' ? null : random_code(config.confirm_email.code_length);

    await db('email_verify_tokens').insert({
        user_id,
        email_normalized,
        code_hash: code ? await bcrypt.hash(code, config.bcrypt_rounds) : null,
        token_hash: crypto_hash_sha256(token).toString('base64url'),
        created_at: now,
        updated_at: now,
        expires_at: date_add_minutes(new Date(), config.confirm_email.expires_minutes),
    });

    return {token, code};
}

module.exports = create_email_verify_token;
